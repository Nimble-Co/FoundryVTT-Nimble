import type { ItemActivationManager } from '#managers/ItemActivationManager.js';
import { getSpellScrollData } from '#utils/createScrollFromSpell.js';
import knowsSpellSchool from '#utils/knowsSpellSchool.js';
import localize from '#utils/localize.js';
import { getSpellSchoolLabel } from '#utils/spellLabels.js';
import toMessageMode from '#utils/toMessageMode.js';
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

/**
 * Object sizes that carry a quantity, and so fold into an item of the same name
 * already carried instead of creating a second document.
 */
export const OBJECT_SIZE_TYPES_WITH_QUANTITY: ReadonlySet<string> = new Set([
	'stackable',
	'smallSized',
]);

export class NimbleObjectItem extends NimbleBaseItem<'object'> {
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
		user: User.Stored,
	) {
		// Update quantity if object already exists and is stackable or smallSized
		if (this.isEmbedded && OBJECT_SIZE_TYPES_WITH_QUANTITY.has(this.system.objectSizeType)) {
			const existing = this.actor?.items.find(
				(i) =>
					i instanceof NimbleObjectItem &&
					i.name === this.name &&
					i.type === 'object' &&
					OBJECT_SIZE_TYPES_WITH_QUANTITY.has(i.system.objectSizeType),
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
	 * A spell scroll casts the spell inscribed on it, with three differences from
	 * casting it normally: it costs no mana, it cannot be upcast, and the scroll is
	 * consumed when used.
	 *
	 * Using a scroll always requires one prompt before it is spent. If the wielder
	 * knows no spells from the scroll's school, that prompt is the Arcana check. If
	 * they do, it is a simple confirmation instead.
	 *
	 * Cancelling the prompt leaves the scroll intact. Once confirmed, the scroll is
	 * consumed either way: a failed Arcana check wastes it, while a successful one
	 * casts the spell.
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

		// The check gates the effect: if the wielder cannot read the scroll, the spell
		// is never cast. When no check is needed, the confirmation takes its place so
		// there is still a chance to cancel before spending the scroll. We cannot rely
		// on the spell's activation dialog for that because `skipRollDialog` or holding
		// Alt can suppress it.
		if (needsArcanaCheck) {
			const outcome = await this.#rollScrollArcanaCheck(scroll.school);

			if (outcome === 'cancelled') return null;
			if (outcome === 'failed') {
				await this.#consumeScroll();
				return null;
			}
		} else if (!(await this.#confirmScrollUse())) {
			return null;
		}

		const chatCard = await super.activate(options);

		await this.#consumeScroll();

		return chatCard;
	}

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
	 * Rolls the scroll's DC 10 Arcana check through the normal skill-check flow,
	 * giving the wielder the usual Configure Arcana Skill Check dialog and a chance
	 * to apply situational modifiers.
	 *
	 * Closing the dialog returns `cancelled`, and the caller leaves the scroll
	 * untouched. If the player never agreed to make the check, the scroll should
	 * not be spent.
	 *
	 * If the actor cannot roll a skill check, this throws instead of letting them
	 * bypass it. Knowing a spell from the scroll's school is the only exemption in
	 * the rules, so skipping the check would actually make that actor better at
	 * using scrolls than a character.
	 *
	 * Today this cannot happen: only `NimbleCharacter` can roll skill checks, and
	 * only characters can carry a scroll. It matters if another actor type gains
	 * an inventory later.
	 */
	async #rollScrollArcanaCheck(school: string): Promise<'passed' | 'failed' | 'cancelled'> {
		const actor = this.actor as
			| (Actor & {
					rollSkillCheck?: (
						skillKey: 'arcana',
						options?: Record<string, unknown>,
					) => Promise<{
						roll: { total?: number | null } | null;
						rollData: { visibilityMode?: string } | null;
					}>;
			  })
			| null;

		if (!actor?.rollSkillCheck) {
			throw new Error(
				`Nimble | ${actor?.type ?? 'An actor with no type'} cannot roll the Arcana check a spell scroll requires.`,
			);
		}

		const { roll, rollData } = await actor.rollSkillCheck('arcana', {
			checkHint: localize('NIMBLE.spellScroll.arcanaCheckHint', {
				school: getSpellSchoolLabel(school),
			}),
		});
		if (!roll) return 'cancelled';

		const succeeded = (roll.total ?? 0) >= SPELL_SCROLL_ARCANA_DC;

		const chatData = {
			speaker: ChatMessage.getSpeaker({ actor: this.actor }),
			flavor: this.name ?? '',
			rolls: [roll as object as Roll],
			content: localize(
				succeeded
					? 'NIMBLE.spellScroll.chat.arcanaSuccess'
					: 'NIMBLE.spellScroll.chat.arcanaFailure',
			),
		} as ChatMessage.CreateData;

		// A GM who hid the roll hid its outcome too, so the pass/fail line follows
		// the roll's own mode.
		ChatMessage.applyMode(chatData, toMessageMode(rollData?.visibilityMode));

		await ChatMessage.create(chatData);

		return succeeded ? 'passed' : 'failed';
	}

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
