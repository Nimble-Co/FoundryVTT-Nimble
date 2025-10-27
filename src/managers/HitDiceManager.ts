import type { NimbleCharacter } from '../documents/actor/character.js';

class HitDiceManager {
	#actor: NimbleCharacter;

	#max = 0;

	#value = 0;

	dieSizes = new Set<number>();

	constructor(actor: NimbleCharacter) {
		this.#actor = actor;

		Object.values(this.#actor.classes).forEach((cls) => {
			const { size } = cls.hitDice;
			const current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;

			this.#max += cls.hitDice.total;
			this.#value += current;
			this.dieSizes.add(size);
		});

		// Account for bonuses
		Object.entries(this.#actor.system.attributes.hitDice ?? {}).forEach(([die, data]) => {
			const size = Number(die);
			if (!size || Number.isNaN(size)) return;

			const bonus = this.#actor.system.attributes.hitDice[size]?.bonus ?? 0;
			this.#max += bonus;
			if (!this.dieSizes.has(size)) this.#value += data.current ?? 0;
			this.dieSizes.add(size);
		});
	}

	get max(): number {
		return this.#max;
	}

	get value(): number {
		return this.#value;
	}

	get smallest(): number {
		return this.dieSizes.size ? Math.min(...this.dieSizes) : 0;
	}

	get largest(): number {
		return this.dieSizes.size ? Math.max(...this.dieSizes) : 0;
	}

	get bySize(): Record<string, { current: number; total: number }> {
		const hitDiceByClass = Object.values(this.#actor.classes ?? {}).reduce((acc, cls) => {
			const { total, size } = cls.hitDice;
			acc[size] ??= { current: 0, total: 0 };
			acc[size].current += this.#actor.system.attributes.hitDice[size]?.current ?? 0;
			acc[size].total += total;
			return acc;
		}, {});

		// Factor in bonuses
		for (const [die, data] of Object.entries(this.#actor.system.attributes.hitDice ?? {})) {
			const bonus = data.bonus ?? 0;

			// Add current to obj
			foundry.utils.setProperty(hitDiceByClass, `${die}.current`, data.current ?? 0);

			// Update total with bonus
			foundry.utils.setProperty(
				hitDiceByClass,
				`${die}.total`,
				bonus + (hitDiceByClass[die]?.total ?? 0),
			);
		}

		return hitDiceByClass;
	}

	getHitDieData(size: number) {
		return this.#actor.system.attributes.hitDice[size] ?? undefined;
	}

	async rollHitDice(dieSize?: number, quantity?: number, maximize?: boolean): Promise<any> {
		if (!dieSize) dieSize = this.largest;
		if (!quantity) quantity = 1;
		if (!maximize) maximize = false;

		const current = this.getHitDieData(dieSize)?.current ?? 0;
		if (current < quantity) return null;

		const strMod = this.#actor.system.abilities.strength.mod ?? 0;

		const formula = maximize
			? `${quantity * dieSize} + ${strMod * quantity}`
			: `${quantity}d${dieSize} + ${strMod * quantity}`;

		// Roll Formula
		const { chatData } = await this.#rollHitDice(dieSize, current, quantity, formula);

		this.#actor.update({
			[`system.attributes.hitDice.${dieSize}.current`]: Math.max(current - quantity, 0),
		});

		const chatCard = await ChatMessage.create(chatData);
		// TODO: Call Hook Data

		return chatCard;
	}

	async #rollHitDice(
		dieSize: number,
		currentCount: number,
		quantity: number,
		formula: string,
	): Promise<{ hookData: any; chatData: any }> {
		const roll = await new Roll(formula).roll();

		// const title = 'THIS IS A HIT DICE ROLL';
		const chatData = {
			author: game.user?.id,
			// @ts-ignore
			speaker: ChatMessage.getSpeaker({ actor: this.#actor }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {}, // TODO: Update this
			type: 'base',
		};

		const hpDelta = Math.max(roll.total, 0);
		// const maxHp = this.#actor.system.attributes.hp.max;

		this.#actor.applyHealing(hpDelta);

		const hookData = {}; // TODO: Update

		return { hookData, chatData };
	}

	getUpdateData({ upperLimit = 0, restoreLargest = true }: UpdateDataOptions = {}) {
		if (!upperLimit) upperLimit = Math.max(Math.floor(this.max / 2), 1) || 1;

		const updates = {};
		const recovered = 0;
		const recoveredData: Record<string, number> = {};

		const data = Object.entries(this.bySize).sort(([a], [b]) => {
			if (restoreLargest) return Number.parseInt(b, 10) - Number.parseInt(a, 10);
			return Number.parseInt(a, 10) - Number.parseInt(b, 10);
		});

		data.forEach(([die, { current, total }]) => {
			current ??= 0;
			const consumed = total - current;
			if (consumed === 0) return;
			if (recovered >= upperLimit) return;

			const recoverable = Math.min(consumed, upperLimit - recovered);
			recoveredData[die] ??= 0;
			recoveredData[die] += recoverable;
			updates[`system.attributes.hitDice.${die}.current`] = current + recoverable;
		});

		// Perform rule clean up
		data.forEach(([die, { current, total }]) => {
			if (current === 0 && total === 0) {
				updates[`system.attributes.hitDice.-=${die}`] = null;
			}
		});

		return { updates, recoveredData };
	}
}

export interface UpdateDataOptions {
	upperLimit?: number | undefined;
	restoreLargest?: boolean | undefined;
}

export { HitDiceManager };
