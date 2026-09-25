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

/**
 * Holds until Dice So Nice has finished throwing the dice for a message.
 *
 * Creating the message only starts the animation, so without this the scroll's next
 * prompt opens over dice that are still rolling and gives away the result. DSN's own
 * API resolves right away when the module is absent, disabled, or configured to show
 * chat messages immediately.
 */
async function waitForDiceAnimation(messageId: string | undefined): Promise<void> {
	if (!messageId) return;

	const { dice3d } = game as {
		dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<unknown> };
	};

	await dice3d?.waitFor3DAnimationByMessageID?.(messageId);
}

async function confirmDeleteStockedContainer(name: string, storedCount: number): Promise<boolean> {
	return Boolean(
		await foundry.applications.api.DialogV2.confirm({
			window: { title: localize('NIMBLE.containers.deleteStockedTitle') },
			content: `<p>${localize('NIMBLE.containers.deleteStocked', {
				container: foundry.utils.escapeHTML(name),
				count: String(storedCount),
			})}</p>`,
			rejectClose: false,
			modal: true,
		}),
	);
}

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
		if (this.isEmbedded) this.#discardUnknownContainerId();

		// Update quantity if object already exists and is stackable or smallSized
		if (this.isEmbedded && OBJECT_SIZE_TYPES_WITH_QUANTITY.has(this.system.objectSizeType)) {
			// Arrows in a quiver and arrows on the belt are separate piles.
			const existing = this.actor?.items.find(
				(i) =>
					i instanceof NimbleObjectItem &&
					i.name === this.name &&
					i.type === 'object' &&
					i.system.containerId === this.system.containerId &&
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
	 * A copy made from a stored object carries the id of a container on the actor it
	 * came from, which names nothing here. Left in place it hides the copy's equip
	 * toggle and keeps it out of the loose stack, so it is cleared before the
	 * stacking check reads it.
	 */
	#discardUnknownContainerId(): void {
		const { containerId } = this.system;
		if (!containerId) return;

		const container = this.actor?.items.get(containerId);
		const holdsObjects =
			container?.type === 'object' &&
			(container as unknown as NimbleObjectItem).system.container.enabled;

		if (holdsObjects) return;

		this.updateSource({ 'system.containerId': '' } as Record<string, unknown>);
	}

	/**
	 * The ids of the objects this container currently holds. Ids passed in are left
	 * out: an object deleted in the same batch as its container is still in the
	 * collection while the hooks run, and writing to it would fail.
	 */
	#getStoredItemIds(
		excludedIds: readonly string[] = [],
		{ includeDisabled = false } = {},
	): string[] {
		const actor = this.actor;
		if (!actor) return [];
		if (!includeDisabled && !this.system.container.enabled) return [];

		const excluded = new Set(excludedIds);

		return actor.items
			.filter(
				(item) =>
					item.type === 'object' &&
					(item as unknown as NimbleObjectItem).system.containerId === this.id &&
					!excluded.has(item.id as string),
			)
			.map((item) => item.id as string);
	}

	/**
	 * A stored object cannot become a container, because a container cannot sit
	 * inside another one. The drop path already refuses the nesting; this refuses
	 * the same thing done from the object's own sheet.
	 */
	protected override async _preUpdate(
		changed: Record<string, unknown>,
		options: Item.Database.UpdateOptions,
		user: User.Stored,
	): Promise<boolean | undefined> {
		const becomingAContainer =
			foundry.utils.getProperty(changed, 'system.container.enabled') === true &&
			!this.system.container.enabled;

		if (becomingAContainer && this.system.containerId) {
			ui.notifications?.warn(
				localize('NIMBLE.containers.rejection.nestedConfig', { object: this.name }),
			);
			return false;
		}

		return super._preUpdate(changed, options, user);
	}

	/**
	 * Unticking the container box leaves its contents pointing at an object that no
	 * longer holds anything, which hides their equip toggle and refuses them a way
	 * back out. They are released the same way a deleted container releases them.
	 */
	override _onUpdate(changed, options, userId: string): void {
		super._onUpdate(changed, options, userId);

		if (game.user?.id !== userId) return;
		if (foundry.utils.getProperty(changed, 'system.container.enabled') !== false) return;

		const strandedItemIds = this.#getStoredItemIds([], { includeDisabled: true });
		if (strandedItemIds.length === 0) return;

		void this.#releaseStoredItems(strandedItemIds);
	}

	/**
	 * Whether the player still wants this container deleted once they know it will
	 * be emptied. Emptying a bag is a surprise when they only meant to bin it, so
	 * one holding anything asks first.
	 *
	 * The sheet asks, not the delete lifecycle: `_preDelete` is awaited for every
	 * deletion, so a prompt there would stop a migration or a macro on one modal per
	 * container.
	 */
	async confirmDeleteWithContents(): Promise<boolean> {
		const storedCount = this.#getStoredItemIds().length;
		if (storedCount === 0) return true;

		return confirmDeleteStockedContainer(this.name, storedCount);
	}

	/**
	 * Spills a deleted container's contents back into the carrier's inventory, so
	 * they stop pointing at an item that no longer exists and go back to costing
	 * their own slots.
	 *
	 * The spill waits for `_onDelete` rather than for the pre-delete hook, because
	 * `preDeleteItem` hooks and the server both get a say after that returns.
	 * Writing earlier can empty a bag that then survives.
	 */
	override _onDelete(options, userId: string): void {
		super._onDelete(options, userId);

		if (game.user?.id !== userId) return;

		const deletedIds = Array.isArray(options?.ids) ? (options.ids as string[]) : [];
		const storedItemIds = this.#getStoredItemIds(deletedIds);
		if (storedItemIds.length === 0) return;

		void this.#releaseStoredItems(storedItemIds);
	}

	async #releaseStoredItems(storedItemIds: string[]): Promise<void> {
		const updates = storedItemIds.map((_id) => ({ _id, 'system.containerId': '' }));

		try {
			await this.actor?.updateEmbeddedDocuments('Item', updates as Item.UpdateData[]);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(error);
			ui.notifications?.error(
				localize('NIMBLE.containers.releaseFailed', { container: this.name }),
			);
		}
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

		const message = await ChatMessage.create(chatData);

		await waitForDiceAnimation(message?.id ?? undefined);

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

	/**
	 * Equipping an object switches its rules on, unequipping switches them off. Both
	 * go in one update: written separately, a rejected second write would leave the
	 * object equipped with its rules off, or stowed with them still running.
	 */
	async toggleEquipment(): Promise<void> {
		const newEquippedState = !this.system.equipped;

		await this.update({
			'system.rules': this.rules.withAllRulesDisabled(!newEquippedState),
			'system.equipped': newEquippedState,
		} as Record<string, unknown>);
	}
}
