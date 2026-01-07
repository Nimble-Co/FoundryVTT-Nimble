import type { HitDiceManager } from './HitDiceManager.js';

// Uses NimbleCharacterInterface ambient type from actor.d.ts

/** Extended NimbleCharacter interface for RestManager */
interface RestableCharacter extends NimbleCharacterInterface {
	HitDiceManager: HitDiceManager;
}

class RestManager {
	#actor: RestableCharacter;

	#data: RestManager.Data;

	#restType: 'field' | 'safe';

	#summary: string[];

	#updates: { actor: Record<string, unknown>; items: Record<string, unknown>[] };

	constructor(actor: RestableCharacter, data: RestManager.Data) {
		this.#actor = actor;
		this.#summary = [];
		this.#restType = data.restType || 'field';

		this.#updates = { actor: {}, items: [] };

		const defaultData: RestManager.Data = {
			restType: 'field',
			makeCamp: false,
			skipChatCard: false,
		};

		this.#data = foundry.utils.mergeObject(defaultData, data);
	}

	get restTypes(): string[] {
		if (this.#restType === 'safe') {
			return ['fieldRest', 'recharge', 'round', 'turn', 'minute', 'hour', 'safeRest', 'day'];
		}

		return ['fieldRest', 'recharge', 'round', 'turn', 'minute', 'hour'];
	}

	async rest() {
		const { skipChatCard } = this.#data;

		if (this.#restType === 'safe') {
			this.#restoreHitDice();
			this.#restoreHitPoints();
			this.#restoreMana();
			this.#restoreWounds();
		}

		this.#consumeHitDice();

		// TODO: Call Pre Hook

		// TODO: Roll Hit Dice

		// Update Documents
		await this.#actor.update(this.#updates.actor);
		await this.#actor.updateEmbeddedDocuments('Item', this.#updates.items);

		// Broadcast Summary
		if (this.#summary.length > 0 && !skipChatCard) {
			let innerContent = '';
			this.#summary.forEach((i) => {
				innerContent += `<li>${i}</li>`;
			});

			const content = `<div> <ul> ${innerContent} </ul> </div>`;

			await ChatMessage.create({
				author: game.user?.id,
				speaker: ChatMessage.getSpeaker({ actor: this.#actor as object as Actor }),
				content,
				type: 'base',
			});
		}

		// TODO: Call Post hook
	}

	/** ------------------------------------------ */
	/** Consume Methods                            */
	/** ------------------------------------------ */
	#consumeHitDice() {
		const { selectedHitDice, makeCamp = false } = this.#data;

		Object.entries(selectedHitDice ?? {}).forEach(([size, quantity]) => {
			this.#actor.HitDiceManager.rollHitDice(Number(size), quantity, makeCamp);
		});
	}

	/** ------------------------------------------ */
	/** Recovery Methods                           */
	/** ------------------------------------------ */
	#restoreHitDice() {
		// Safe rest restores ALL hit dice
		const maxHitDice = this.#actor.HitDiceManager.max;
		const { updates, recoveredData } = this.#actor.HitDiceManager.getUpdateData({
			upperLimit: maxHitDice,
			restoreLargest: true,
		});

		this.#updates.actor = foundry.utils.mergeObject(this.#updates.actor, updates);

		Object.entries(recoveredData ?? {}).forEach(([die, amount]) => {
			this.#summary.push(`Recovered ${amount} hit dice. (d${die})`);
		});
	}

	#restoreHitPoints() {
		const { value, max, temp } = this.#actor.system.attributes.hp;

		this.#updates.actor['system.attributes.hp'] = { value: max, temp: 0 };

		if (max > value) {
			this.#summary.push(`Restored ${max - value} hp.`);
		}

		if (temp > 0) {
			this.#summary.push(`Removed ${temp} temporary hp.`);
		}
	}

	#restoreMana() {
		const { current, max } = this.#actor.system.resources.mana;
		if (current < max) {
			this.#updates.actor['system.resources.mana'] = { current: max };
			this.#summary.push(`Restored ${max - current} mana.`);
		}
	}

	#restoreWounds() {
		const { value } = this.#actor.system.attributes.wounds;

		this.#updates.actor['system.attributes.wounds'] = {
			value: Math.max(value - 1, 0),
		};

		if (value !== 0) this.#summary.push('Recovered 1 wound.');
	}
}

declare namespace RestManager {
	interface Data {
		restType: 'field' | 'safe';
		makeCamp?: boolean;
		skipChatCard: boolean;
		selectedHitDice?: Record<number, number>;
	}
}

export { RestManager };
