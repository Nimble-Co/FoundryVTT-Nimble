class HitDiceManager {
	#actor: NimbleCharacterInterface;

	#max = 0;

	#value = 0;

	dieSizes = new Set<number>();

	constructor(actor: NimbleCharacterInterface) {
		this.#actor = actor;

		// Track which sizes we've already counted current for
		const currentCounted = new Set<number>();

		// Process class hit dice
		Object.values(this.#actor.classes).forEach((cls) => {
			const { size } = cls.hitDice;
			const current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;

			this.#max += cls.hitDice.total;
			if (!currentCounted.has(size)) {
				this.#value += current;
				currentCounted.add(size);
			}
			this.dieSizes.add(size);
		});

		// Account for bonus hit dice from the bonusHitDice array
		for (const entry of this.#actor.system.attributes.bonusHitDice ?? []) {
			this.#max += entry.value;

			// If this is a new size not from classes, get its current value
			if (!currentCounted.has(entry.size)) {
				const current = this.#actor.system.attributes.hitDice[entry.size]?.current ?? 0;
				this.#value += current;
				currentCounted.add(entry.size);
			}
			this.dieSizes.add(entry.size);
		}
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

		// Factor in bonus hit dice from the bonusHitDice array
		for (const entry of this.#actor.system.attributes.bonusHitDice ?? []) {
			const size = entry.size;
			hitDiceByClass[size] ??= { current: 0, total: 0 };
			hitDiceByClass[size].total += entry.value;

			// If this size wasn't from a class, get the current value from hitDice record
			if (!Object.values(this.#actor.classes ?? {}).some((cls) => cls.hitDice.size === size)) {
				hitDiceByClass[size].current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;
			}
		}

		return hitDiceByClass;
	}

	getHitDieData(size: number) {
		return this.#actor.system.attributes.hitDice[size] ?? undefined;
	}

	async rollHitDice(dieSize?: number, quantity?: number, maximize?: boolean): Promise<any> {
		const dSize = dieSize ?? this.largest;
		const dQuantity = quantity ?? 0;
		const maximizeDie = maximize ?? false;

		// Skip rolling if no dice selected
		if (dQuantity === 0) return null;

		const current = this.getHitDieData(dSize)?.current ?? 0;
		if (current < dQuantity) return null;

		const strMod = this.#actor.system.abilities.strength.mod ?? 0;

		const formula = maximizeDie
			? `${dQuantity * dSize} + ${strMod * dQuantity}`
			: `${dQuantity}d${dSize} + ${strMod * dQuantity}`;

		// Roll Formula
		const { chatData } = await this.#rollHitDice(dSize, current, dQuantity, formula);

		this.#actor.update({
			[`system.attributes.hitDice.${dSize}.current`]: Math.max(current - dQuantity, 0),
		});

		const chatCard = await ChatMessage.create(chatData);
		// TODO: Call Hook Data

		return chatCard;
	}

	async #rollHitDice(
		dieSize: number,
		_currentCount: number,
		quantity: number,
		formula: string,
	): Promise<{ hookData: any; chatData: any }> {
		const rollFormula = formula
			? formula
			: dieSize > 0 && quantity > 0
				? `${quantity}d${dieSize}`
				: '';
		const roll = rollFormula ? await new Roll(rollFormula).roll() : await new Roll('0').roll();

		// const title = 'THIS IS A HIT DICE ROLL';
		const chatData = {
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: this.#actor as object as Actor }),
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
		let recovered = 0;
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
			recovered += recoverable;
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
