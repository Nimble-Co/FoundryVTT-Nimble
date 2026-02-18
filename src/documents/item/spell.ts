import { DamageRoll } from '../../dice/DamageRoll.js';
import { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import type { NimbleSpellData } from '../../models/item/SpellDataModel.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleSpellItem extends NimbleBaseItem {
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
		const { activation, rolls, rollHidden } = await manager.getData();
		if (activation === null || rolls === null) {
			return null;
		}

		// Deduct mana for tiered spells (cantrips are free)
		if (this.system.tier > 0 && this.actor) {
			// Use upcast amount if available, otherwise use base tier cost
			const manaSpent = manager.upcastResult?.manaSpent ?? this.system.tier;
			const currentMana = (this.actor.system as any).resources?.mana?.current || 0;
			await this.actor.update({
				'system.resources.mana.current': Math.max(0, currentMana - manaSpent),
			} as any);
		}

		const { isCritical, isMiss } = rolls.find((roll) => roll instanceof DamageRoll) ?? {};

		// Only allow hiding rolls for GM users rolling for non-PC actors
		const canHideRoll = game.user?.isGM && this.actor?.type !== 'character';
		const shouldHide = rollHidden && canHideRoll;

		const chatData = foundry.utils.mergeObject(
			{
				author: game.user?.id,
				flavor: `${this.actor?.name}: ${this.name}`,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				style: CONST.CHAT_MESSAGE_STYLES.OTHER,
				sound: CONFIG.sounds.dice,
				rolls,
				system: {
					actorName: this.actor?.name ?? '',
					actorType: this.actor?.type ?? '',
					activation,
					image: this.img || 'icons/svg/item-bag.svg',
					isCritical,
					isMiss,
					permissions: this.permission,
					rollMode: options.rollMode ?? 0,
					targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
					// Add upcast result to chat data
					upcast: manager.upcastResult,
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

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard || null;
	}

	override async prepareChatCardData() {
		const showDescription = this.system.activation.showDescription;
		const baseEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.baseEffect,
		);

		const higherLevelEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.higherLevelEffect,
		);

		return {
			system: {
				actorName: this.actor?.name ?? game?.user?.name ?? '',
				description: {
					baseEffect: showDescription ? baseEffect : '',
					higherLevelEffect: showDescription ? higherLevelEffect : '',
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
