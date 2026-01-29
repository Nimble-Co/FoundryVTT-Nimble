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
		console.log('[Spell.activate] Called with options:', options);

		if (options?.executeMacro) {
			console.log('[Spell.activate] Delegating to super (executeMacro=true)');
			const result: ChatMessage | null = (await super.activate(options)) ?? null;
			return result;
		}

		console.log('[Spell.activate] Creating manager');
		const manager = new ItemActivationManager(this as any, options);
		const { activation, rolls } = await manager.getData();
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

		const chatData = foundry.utils.mergeObject(
			{
				author: game.user?.id,
				flavor: `${this.actor?.name}: ${this.name}`,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				style: CONST.CHAT_MESSAGE_STYLES.OTHER,
				sound: CONFIG.sounds.dice,
				rolls,
				rollMode: options.visibilityMode ?? game.settings.get('core', 'rollMode'),
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

		const rollModeValue = options.visibilityMode ?? game.settings.get('core', 'rollMode');
		ChatMessage.applyRollMode(
			chatData as Record<string, unknown>,
			rollModeValue as foundry.CONST.DICE_ROLL_MODES,
		);

		console.log('[Spell.activate] Creating chat message');
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		console.log('[Spell.activate] Chat message created:', chatCard?.id);

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
