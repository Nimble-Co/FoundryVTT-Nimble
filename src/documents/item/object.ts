import type { ItemActivationManager } from '#managers/ItemActivationManager.js';
import getSpellScrollData from '#utils/getSpellScrollData.js';
import knowsSpellSchool from '#utils/knowsSpellSchool.js';
import localize from '#utils/localize.js';
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

		const succeeded = await this.#rollScrollArcanaCheck(scroll.school);

		// The scroll is consumed on a failure too: the rules waste it.
		if (!succeeded) {
			await this.#consumeScroll();
			return null;
		}

		const chatCard = await super.activate(options);
		await this.#consumeScroll();

		return chatCard;
	}

	/**
	 * Rolls the scroll's Arcana check when it is required, reporting the outcome
	 * to chat. Returns whether the spell takes effect.
	 */
	async #rollScrollArcanaCheck(school: string): Promise<boolean> {
		const actor = this.actor as
			| (Actor & {
					rollSkillCheck?: (
						skillKey: 'arcana',
						options: { skipRollDialog?: boolean },
					) => Promise<{ roll: { total?: number | null } | null }>;
			  })
			| null;

		// No actor to roll against, or the wielder already knows the school.
		if (!actor?.rollSkillCheck) return true;
		if (
			knowsSpellSchool(actor as { items?: Iterable<{ type: string; system?: unknown }> }, school)
		) {
			return true;
		}

		const { roll } = await actor.rollSkillCheck('arcana', { skipRollDialog: true });
		if (!roll) return false;

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

		return succeeded;
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
