import { SYSTEM_ID, systemHookName } from '#system';
import type { ResolvedSpellCost } from '#types/spellCost.d.ts';
import { DamageRoll } from '../../dice/DamageRoll.js';
import { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import type { NimbleSpellData } from '../../models/item/SpellDataModel.js';
import localize from '../../utils/localize.js';
import confirmSpellOverdraft from '../../utils/spell/confirmSpellOverdraft.js';
import { paySpellCost } from '../../utils/spell/paySpellCost.js';
import { previewOverdraftDamage } from '../../utils/spell/spellCost.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleSpellItem extends NimbleBaseItem<'spell'> {
	declare system: NimbleSpellData;

	override _populateBaseTags() {
		super._populateBaseTags();

		if (this.system.school) this.tags.add(`school:${this.system.school}`);
		this.system.properties.selected?.forEach((p) => {
			this.tags.add(`property:${p}`);
		});

		if (!this.tags.has('property:utility')) this.tags.add(`tier:${this.system.tier}`);
	}

	override _populateDerivedTags() {
		super._populateDerivedTags();
	}

	override async activate(
		options: ItemActivationManager.ActivationOptions = {},
	): Promise<ChatMessage | null> {
		if (options?.executeMacro) {
			const result: ChatMessage | null = (await super.activate(options)) ?? null;
			return result;
		}

		const manager = new ItemActivationManager(this as any, options);
		const { activation, rolls, rollHidden, incomingReactions } = await manager.getData();
		if (activation === null || rolls === null) {
			return null;
		}

		const { isCritical, isMiss } = rolls.find((roll) => roll instanceof DamageRoll) ?? {};

		/**
		 * A hook event that fires before an item is used.
		 * @function nimble.preUseItem
		 * @memberof hookEvents
		 * @param {Item} item           The item being used
		 * @param {Object} context       Additional context about the item use
		 * @param {Roll[]} context.rolls The rolls associated with the item use
		 * @param {boolean} [context.isCritical] Whether the item use resulted in a critical hit
		 * @param {boolean} [context.isMiss] Whether the item use resulted in a miss
		 * @param {Token[]} context.targets The targets of the item use
		 * @returns {boolean}  Explicitly return `false` to prevent the item from being used.
		 */
		// @ts-expect-error - nimble.preUseItem is a custom hook
		const allowed = Hooks.call(systemHookName('preUseItem'), this, {
			rolls,
			isCritical,
			isMiss,
			targets: Array.from(game.user?.targets ?? []),
			upcast: manager.upcastResult,
		});
		if (!allowed) return null;

		// The manager resolved what this cast costs (cantrips are free), against
		// the tier actually cast. The seam decides whether the cost is mana or a
		// class-declared pool, and honours the resource spending automation
		// setting internally.
		const spellCost: ResolvedSpellCost = manager.spellCost ?? { type: 'none' };
		if (this.system.tier > 0 && this.actor) {
			const payment = await paySpellCost(this.actor, spellCost, {
				confirmOverdraft: (available) =>
					confirmSpellOverdraft({
						spellName: this.name,
						cost: spellCost,
						available,
						damage: previewOverdraftDamage(this.actor!, spellCost),
					}),
			});

			if (!payment.paid) {
				if (payment.failure) {
					const messageKey =
						payment.failure.code === 'poolMissing'
							? 'NIMBLE.charges.notifications.poolMissing'
							: 'NIMBLE.charges.notifications.insufficient';
					ui.notifications?.error(
						localize(messageKey, {
							item: this.name,
							pool: payment.failure.poolLabel,
							required: String(payment.failure.required),
							available: String(payment.failure.available),
						}),
					);
				}
				return null;
			}
		}

		// Dialog spends and pool-node side effects land only once the cast is
		// allowed and paid for, so a refusal above costs the player nothing.
		await manager.commitDeferredSideEffects();

		// Only allow hiding rolls for GM users rolling for non-PC actors
		const canHideRoll = game.user?.isGM && this.actor?.type !== 'character';
		const shouldHide = rollHidden && canHideRoll;

		const chatData = foundry.utils.mergeObject(
			{
				author: game.user?.id,
				flavor: `${this.actor?.name}: ${this.name}`,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				style: CONST.CHAT_MESSAGE_STYLES.OTHER,
				// Roll-less activations (descriptive spells) post a card without dice audio
				sound: rolls.length > 0 ? CONFIG.sounds.dice : null,
				rolls,
				flags: {
					[SYSTEM_ID]: {
						itemId: this.id,
						itemUuid: this.uuid,
						actorId: this.actor?.id,
						tokenUuid: this.actor?.token?.uuid,
					},
				},
				system: {
					actorName: this.actor?.name ?? '',
					actorType: this.actor?.type ?? '',
					activation,
					image: this.img || 'icons/svg/item-bag.svg',
					incomingReactions: incomingReactions ?? [],
					isCritical,
					isMiss,
					permissions: this.permission,
					rollMode: options.rollMode ?? 0,
					targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
					// Add upcast result to chat data
					upcast: manager.upcastResult,
					// A pinned tier reaches the card without an upcast to read it from.
					castTier: manager.pinnedCastTier,
				},
				type: 'spell',
			},
			await this.prepareChatCardData(),
		);

		if (shouldHide) {
			// Whisper to GM users only
			const gmUsers = game.users?.filter((u) => u.isGM).map((u) => u.id) ?? [];
			(chatData as Record<string, unknown>).whisper = gmUsers;
		}

		return this._createActivationCard(chatData, rolls, activation, {
			rolls,
			isCritical,
			isMiss,
			targets: Array.from(game.user?.targets ?? []),
			upcast: manager.upcastResult,
		});
	}

	override async prepareChatCardData() {
		const showDescription = this.system.activation.showDescription;
		const baseEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.baseEffect,
		);

		const higherLevelEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.higherLevelEffect,
		);

		const upcastEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.upcastEffect,
		);

		return {
			system: {
				actorName: this.actor?.name ?? game?.user?.name ?? '',
				description: {
					baseEffect: showDescription ? baseEffect : '',
					higherLevelEffect: showDescription ? higherLevelEffect : '',
					upcastEffect: showDescription ? upcastEffect : '',
				},
				duration: {
					concentration: this.tags.has('property:concentration'),
					period: this.tags.has('property:utility'),
				},
				img: this.img ?? 'icons/svg/explosion.svg',
				tier: this.system.tier,
				school: this.system.school,
				spellName: this.name,
			},
			type: 'spell',
		};
	}
}
