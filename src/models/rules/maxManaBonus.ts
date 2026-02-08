import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import { NimbleBaseRule } from './base.js';

/** Actor system data with mana attributes */
interface ActorSystemWithMana {
	resources: {
		mana: {
			bonus: number;
		};
	};
}

/** Class item system data */
interface ClassItemSystem {
	classLevel: number;
}

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		perLevel: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxManaBonus' }),
	};
}

declare namespace MaxManaBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxManaBonusRule extends NimbleBaseRule<MaxManaBonusRule.Schema> {
	declare value: number;
	declare perLevel: boolean;

	static override defineSchema(): MaxManaBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['perLevel', 'boolean'],
			]),
		);
	}

	override async preCreate(): Promise<void> {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor) return;

		// Update actor bonus mana
		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedMana = getDeterministicBonus(formula, actor.getRollData());
		if (addedMana === null) return;

		const actorSystem = actor.system as unknown as ActorSystemWithMana;
		const { bonus } = actorSystem.resources.mana;
		await actor.update({ system: { resources: { mana: { bonus: bonus + addedMana } } } } as Record<
			string,
			unknown
		>);
	}

	async preUpdate(changes: Record<string, unknown>): Promise<void> {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;
		if (item.type !== 'class') return;

		if (!this.perLevel) return;

		// Return if update doesn't pertain to level
		const keys = Object.keys(foundry.utils.flattenObject(changes));
		const itemSystem = item.system as unknown as ClassItemSystem;
		if (
			!keys.includes('system.classLevel') ||
			changes['system.classLevel'] === itemSystem.classLevel
		)
			return;

		const formula = this.value;
		const addedMana = getDeterministicBonus(formula, actor.getRollData());
		if (addedMana === null) return;

		const actorSystem = actor.system as unknown as ActorSystemWithMana;
		const { bonus } = actorSystem.resources.mana;
		await actor.update({ system: { resources: { mana: { bonus: bonus + addedMana } } } } as Record<
			string,
			unknown
		>);
	}

	async afterDelete(): Promise<void> {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;

		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedMana = getDeterministicBonus(formula, actor.getRollData());
		if (addedMana === null) return;

		const actorSystem = actor.system as unknown as ActorSystemWithMana;
		const { bonus } = actorSystem.resources.mana;
		await actor.update({ system: { resources: { mana: { bonus: bonus - addedMana } } } } as Record<
			string,
			unknown
		>);
	}
}

export { MaxManaBonusRule };
