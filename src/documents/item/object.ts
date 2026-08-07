import type { ItemActivationManager } from '#managers/ItemActivationManager.js';
import getSpellScrollData from '#utils/getSpellScrollData.js';
import knowsSpellSchool from '#utils/knowsSpellSchool.js';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import type { NimbleObjectData } from '../../models/item/ObjectDataModel.js';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';

import { NimbleBaseItem } from './base.svelte.js';

/** The check a scroll's wielder must pass when they know no spell of its school. */
const SPELL_SCROLL_ARCANA_DC = 10;

type RuleSourceLike = {
	disabled?: boolean;
	[key: string]: unknown;
};

function getRuleSources(item: NimbleObjectItem): RuleSourceLike[] {
	const rules = foundry.utils.getProperty(item, 'system.rules');
	return Array.isArray(rules) ? (rules as RuleSourceLike[]) : [];
}

function syncRuleSourcesToEquippedState(item: NimbleObjectItem): void {
	const rules = getRuleSources(item);
	if (rules.length < 1) return;

	const updatedRules = rules.map((rule) => ({
		...rule,
		disabled: !item.system.equipped,
	}));

	item.updateSource({
		'system.rules': updatedRules,
	} as Record<string, unknown>);
}

export class NimbleObjectItem extends NimbleBaseItem {
	declare system: NimbleObjectData;

	override _populateBaseTags(): void {
		super._populateBaseTags();

		this.tags.add(`objectType:${this.system.objectType}`);
		this.system.properties.selected?.forEach((p) => {
			this.tags.add(`property:${p}`);
		});
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();
	}

	override async prepareChatCardData(_options) {
		const showDescription = this.system.activation.showDescription;
		const publicDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.public,
		);

		const unidentifiedDescription =
			await foundry.applications.ux.TextEditor.implementation.enrichHTML(
				this.system.description.unidentified,
			);

		return {
			system: {
				description: {
					public: showDescription ? publicDescription : '',
					unidentified: showDescription ? unidentifiedDescription : '',
				},
				name: { public: this.name, unidentified: this.system.unidentifiedName },
				isIdentified: this.system.identified,
				objectType: this.system.objectType,
				properties: this.system.properties.selected,
			},
			type: 'object',
		};
	}

	/** ------------------------------------------------------ */
	//                 Document Update Hooks
	/** ------------------------------------------------------ */
	override async _preCreate(
		data: Item.CreateData,
		options: Item.Database.PreCreateOptions,
		user: User,
	) {
		// Update quantity if object already exists and is stackable or smallSized
		const objectSizeTypesWithQuantity = new Set(['stackable', 'smallSized']);
		if (this.isEmbedded && objectSizeTypesWithQuantity.has(this.system.objectSizeType)) {
			const existing = this.actor?.items.find(
				(i) =>
					i instanceof NimbleObjectItem &&
					i.name === this.name &&
					i.type === 'object' &&
					objectSizeTypesWithQuantity.has(i.system.objectSizeType),
			) as NimbleObjectItem | undefined;

			if (!existing) return super._preCreate(data, options, user);

			// Update existing item quantity
			(existing as object as { update(data: object): void }).update({
				'system.quantity': existing.system.quantity + 1,
			});
			return false;
		}

		if (this.isEmbedded) {
			syncRuleSourcesToEquippedState(this);
		}

		return super._preCreate(data, options, user);
	}

	/**
	 * Uses the object.
	 *
	 * A spell scroll casts the spell it carries, with three differences from
	 * casting that spell off a spell list: it costs no mana, it cannot be upcast
	 * (an object never reaches the upcast dialog, which is gated on
	 * `type === 'spell'`), and it is consumed. When the wielder knows no spell of
	 * the scroll's school, a DC 10 Arcana check decides whether it takes effect —
	 * and the scroll is spent either way.
	 */
	override async activate(
		options: ItemActivationManager.ActivationOptions = {},
	): Promise<ChatMessage | null> {
		const scroll = getSpellScrollData(this);
		if (!scroll || options?.executeMacro) return super.activate(options);

		const needsArcanaCheck = !knowsSpellSchool(
			this.actor as { items?: Iterable<{ type: string; system?: unknown }> } | null,
			scroll.school,
		);

		// Nothing is spent until the player commits. When neither the Arcana check
		// nor the spell's own rolls would raise a dialog there is nothing to
		// confirm against, so ask outright — otherwise clicking the row would
		// consume the scroll with no prompt at all.
		if (!needsArcanaCheck && !this.#hasActivationRolls()) {
			const confirmed = await this.#confirmScrollUse();
			if (!confirmed) return null;
		}

		// The check gates the effect: a wielder who cannot read the scroll never
		// casts the spell. Its own dialog is shown rather than skipped, and closing
		// that dialog leaves the scroll untouched.
		if (needsArcanaCheck) {
			const outcome = await this.#rollScrollArcanaCheck();

			if (outcome === 'cancelled') return null;
			if (outcome === 'failed') {
				await this.#consumeScroll();
				return null;
			}
		}

		const chatCard = await super.activate(options);

		// Closing the activation dialog resolves to null. The scroll stays in the
		// pack: it is spent on a roll or a failed check, never on a cancel.
		if (!chatCard) return null;

		await this.#consumeScroll();

		return chatCard;
	}

	/** Whether the scroll's spell has anything to roll, and so raises a dialog. */
	#hasActivationRolls(): boolean {
		const effects = (this.system.activation?.effects ?? []) as Parameters<
			typeof flattenEffectsTree
		>[0];

		return flattenEffectsTree(effects).some(
			(node) => node.type === 'damage' || node.type === 'healing',
		);
	}

	/** Asks before spending a scroll that would otherwise raise no dialog at all. */
	async #confirmScrollUse(): Promise<boolean> {
		return Boolean(
			await foundry.applications.api.DialogV2.confirm({
				window: { title: this.name ?? '' },
				content: `<p>${localize('NIMBLE.spellScroll.confirmUse', { scroll: this.name ?? '' })}</p>`,
				rejectClose: false,
				modal: true,
			}),
		);
	}

	/**
	 * Rolls the scroll's DC 10 Arcana check through the normal skill-check flow, so
	 * the wielder gets the Configure Arcana Skill Check dialog and can apply
	 * situational modifiers rather than having a bare d20 thrown for them.
	 *
	 * Closing that dialog reports `cancelled`, and the caller leaves the scroll
	 * alone — a check the player never agreed to must not spend anything.
	 */
	async #rollScrollArcanaCheck(): Promise<'passed' | 'failed' | 'cancelled'> {
		const actor = this.actor as
			| (Actor & {
					rollSkillCheck?: (
						skillKey: 'arcana',
						options?: Record<string, unknown>,
					) => Promise<{ roll: { total?: number | null } | null }>;
			  })
			| null;

		// Nothing to roll against, so the scroll simply works.
		if (!actor?.rollSkillCheck) return 'passed';

		const { roll } = await actor.rollSkillCheck('arcana');
		if (!roll) return 'cancelled';

		const succeeded = (roll.total ?? 0) >= SPELL_SCROLL_ARCANA_DC;

		await ChatMessage.create({
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: this.name ?? '',
			rolls: [roll as object as Roll],
			content: localize(
				succeeded
					? 'NIMBLE.spellScroll.chat.arcanaSuccess'
					: 'NIMBLE.spellScroll.chat.arcanaFailure',
			),
		} as ChatMessage.CreateData);

		return succeeded ? 'passed' : 'failed';
	}

	/** Spends one use of the scroll, deleting it when the last one is gone. */
	async #consumeScroll(): Promise<void> {
		if (!this.isEmbedded) return;
		if (!isResourceSpendingAutomationEnabled()) return;

		const remaining = this.system.quantity - 1;

		if (remaining > 0) {
			await this.update({ 'system.quantity': remaining } as Record<string, unknown>);
			return;
		}

		await this.delete();
	}

	/** ------------------------------------------------------ */
	//                 Data Functions
	/** ------------------------------------------------------ */

	async toggleEquipment(): Promise<void> {
		const newEquippedState = !this.system.equipped;
		const rulesUpdated = newEquippedState
			? await this.rules.enableAllRules()
			: await this.rules.disableAllRules();
		if (!rulesUpdated) return;

		await this.update({
			'system.equipped': newEquippedState,
		} as Record<string, unknown>);
	}
}
