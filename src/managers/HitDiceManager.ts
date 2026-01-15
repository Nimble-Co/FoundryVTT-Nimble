// Die size progression: d4 -> d6 -> d8 -> d10 -> d12 -> d20
const DIE_SIZES = [4, 6, 8, 10, 12, 20];

function incrementDieSize(baseSize: number, steps: number): number {
	const currentIndex = DIE_SIZES.indexOf(baseSize);
	if (currentIndex === -1) return baseSize; // Unknown die size, return as-is

	const newIndex = Math.min(currentIndex + steps, DIE_SIZES.length - 1);
	return DIE_SIZES[newIndex];
}

class HitDiceManager {
	#actor: NimbleCharacterInterface;

	#max = 0;

	#value = 0;

	dieSizes = new Set<number>();

	constructor(actor: NimbleCharacterInterface) {
		this.#actor = actor;

		// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
		const hitDiceSizeBonus =
			(this.#actor.system.attributes as { hitDiceSizeBonus?: number }).hitDiceSizeBonus ?? 0;

		// Track which sizes we've already counted current for
		const currentCounted = new Set<number>();

		// Process class hit dice
		Object.values(this.#actor.classes).forEach((cls) => {
			// Apply hit dice size bonus to get effective size
			const size = incrementDieSize(cls.hitDice.size, hitDiceSizeBonus);
			const current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;

			this.#max += cls.hitDice.total;
			if (!currentCounted.has(size)) {
				this.#value += current;
				currentCounted.add(size);
			}
			this.dieSizes.add(size);
		});

		// Account for bonus hit dice from the bonusHitDice array
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const entry of this.#actor.system.attributes.bonusHitDice ?? []) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			this.#max += entry.value;

			// If this is a new size not from classes, get its current value
			if (!currentCounted.has(size)) {
				const current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;
				this.#value += current;
				currentCounted.add(size);
			}
			this.dieSizes.add(size);
		}

		// Account for bonus hit dice from rules (stored in hitDice[size].bonus)
		// Rule bonuses add to max; current comes from stored value (restored on rest)
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const [sizeStr, hitDieData] of Object.entries(
			this.#actor.system.attributes.hitDice ?? {},
		)) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = (hitDieData as { bonus?: number }).bonus ?? 0;
			if (bonus > 0) {
				this.#max += bonus;

				// If this is a new size not from classes or bonusHitDice array, get stored current
				if (!currentCounted.has(size)) {
					const current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;
					this.#value += current;
					currentCounted.add(size);
				}
				this.dieSizes.add(size);
			}
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
		// Get hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
		const hitDiceSizeBonus =
			(this.#actor.system.attributes as { hitDiceSizeBonus?: number }).hitDiceSizeBonus ?? 0;

		const hitDiceByClass = Object.values(this.#actor.classes ?? {}).reduce((acc, cls) => {
			const { total } = cls.hitDice;
			// Apply hit dice size bonus to get effective size
			const size = incrementDieSize(cls.hitDice.size, hitDiceSizeBonus);
			acc[size] ??= { current: 0, total: 0 };
			acc[size].current += this.#actor.system.attributes.hitDice[size]?.current ?? 0;
			acc[size].total += total;
			return acc;
		}, {});

		// Get effective class sizes for later checks
		const effectiveClassSizes = Object.values(this.#actor.classes ?? {}).map((cls) =>
			incrementDieSize(cls.hitDice.size, hitDiceSizeBonus),
		);

		// Factor in bonus hit dice from the bonusHitDice array
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const entry of this.#actor.system.attributes.bonusHitDice ?? []) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			hitDiceByClass[size] ??= { current: 0, total: 0 };
			hitDiceByClass[size].total += entry.value;

			// If this size wasn't from a class (after applying bonus), get the current value from hitDice record
			if (!effectiveClassSizes.includes(size)) {
				hitDiceByClass[size].current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;
			}
		}

		// Get effective bonus array sizes (after increment) for later checks
		const effectiveBonusArraySizes = (this.#actor.system.attributes.bonusHitDice ?? []).map(
			(entry) => incrementDieSize(entry.size, hitDiceSizeBonus),
		);

		// Factor in bonus hit dice from rules (stored in hitDice[size].bonus)
		// Rule bonuses add to total; current comes from stored value (restored on rest)
		// Apply hitDiceSizeBonus to increment these dice as well
		for (const [sizeStr, hitDieData] of Object.entries(
			this.#actor.system.attributes.hitDice ?? {},
		)) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = (hitDieData as { bonus?: number }).bonus ?? 0;
			if (bonus > 0) {
				hitDiceByClass[size] ??= { current: 0, total: 0 };
				hitDiceByClass[size].total += bonus;

				// If this size wasn't from a class or bonusHitDice array (after applying bonus), get stored current
				const fromClass = effectiveClassSizes.includes(size);
				const fromBonusArray = effectiveBonusArraySizes.includes(size);
				if (!fromClass && !fromBonusArray) {
					hitDiceByClass[size].current = this.#actor.system.attributes.hitDice[size]?.current ?? 0;
				}
			}
		}

		return hitDiceByClass;
	}

	getHitDieData(size: number) {
		return this.#actor.system.attributes.hitDice[size] ?? undefined;
	}

	async rollHitDice(
		dieSize?: number,
		quantity?: number,
		maximize?: boolean,
		advantage?: boolean,
		skipChatMessage?: boolean,
	): Promise<{ roll: Roll; healing: number } | null> {
		const dSize = dieSize ?? this.largest;
		const dQuantity = quantity ?? 0;
		const maximizeDie = maximize ?? false;
		const hasAdvantage = advantage ?? false;
		const skipChat = skipChatMessage ?? false;

		// Skip rolling if no dice selected
		if (dQuantity === 0) return null;

		const current = this.getHitDieData(dSize)?.current ?? 0;
		if (current < dQuantity) return null;

		const strMod = this.#actor.system.abilities.strength.mod ?? 0;

		// Build formula showing STR bonus per die for clarity
		// Format: (1d8 + STR) + (1d8 + STR) + ... to show each die gets the STR bonus
		let formula: string;
		if (hasAdvantage && !maximizeDie) {
			// Advantage: roll each die twice and keep the higher, plus STR per die
			// Build formula like "(2d8kh1 + 2) + (2d8kh1 + 2) + (2d8kh1 + 2)" for 3 dice with advantage
			const advantageParts = Array(dQuantity)
				.fill(null)
				.map(() => `(2d${dSize}kh1 + ${strMod})`);
			formula = advantageParts.join(' + ');
		} else {
			// Normal roll or maximized: show each die with STR bonus
			// Build formula like "(1d8 + 2) + (1d8 + 2) + (1d8 + 2)" for 3 dice
			const dieParts = Array(dQuantity)
				.fill(null)
				.map(() => `(1d${dSize} + ${strMod})`);
			formula = dieParts.join(' + ');
		}

		// Roll Formula - pass maximize flag
		const { chatData, roll, healing } = await this.#rollHitDice(
			dSize,
			current,
			dQuantity,
			formula,
			maximizeDie,
		);

		this.#actor.update({
			[`system.attributes.hitDice.${dSize}.current`]: Math.max(current - dQuantity, 0),
		});

		if (!skipChat) {
			await ChatMessage.create(chatData);
		}

		return { roll, healing };
	}

	async #rollHitDice(
		dieSize: number,
		_currentCount: number,
		quantity: number,
		formula: string,
		maximize: boolean = false,
	): Promise<{ hookData: any; chatData: any; roll: Roll; healing: number }> {
		const rollFormula = formula
			? formula
			: dieSize > 0 && quantity > 0
				? `${quantity}d${dieSize}`
				: '';
		// Use maximize option to set all dice to their maximum value (for Make Camp)
		const roll = rollFormula
			? await new Roll(rollFormula).roll({ maximize })
			: await new Roll('0').roll();

		// const title = 'THIS IS A HIT DICE ROLL';
		const chatData = {
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: this.#actor as object as Actor }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {}, // TODO: Update this
			type: 'base',
		};

		const healing = Math.max(roll.total ?? 0, 0);

		this.#actor.applyHealing(healing);

		const hookData = {}; // TODO: Update

		return { hookData, chatData, roll, healing };
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

export { HitDiceManager, incrementDieSize };
