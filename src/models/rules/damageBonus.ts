import { NimbleBaseRule } from './base.js';

type DamageBonusTarget = 'melee' | 'ranged' | 'spell' | 'any';

interface DamageBonusEntry {
	value: number;
	damageType: string;
	appliesTo: DamageBonusTarget;
}

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({
			required: true,
			nullable: false,
			initial: '@level',
		}),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'bludgeoning',
		}),
		appliesTo: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: ['melee', 'ranged', 'spell', 'any'],
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageBonus' }),
	};
}

declare namespace DamageBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		damageBonuses?: DamageBonusEntry[];
	};
}

/**
 * Rule that adds bonus damage to attacks, scoped by attack type.
 * Bonuses are accumulated in an array on the actor and applied during item activation.
 */
class DamageBonusRule extends NimbleBaseRule<DamageBonusRule.Schema> {
	declare value: string;
	declare damageType: string;
	declare appliesTo: DamageBonusTarget;

	static override defineSchema(): DamageBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['damageType', 'string'],
				['appliesTo', 'string'],
			]),
		);
	}

	/**
	 * Apply the damage bonus to the actor.
	 * Bonuses are pushed to an array so multiple rules stack correctly.
	 */
	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;
		const resolvedValue = this.resolveFormula(this.value);
		if (resolvedValue === null || resolvedValue === 0) return;

		const actorSystem = actor as object as ActorSystem;
		const existing = actorSystem.system.damageBonuses ?? [];

		foundry.utils.setProperty(actor.system, 'damageBonuses', [
			...existing,
			{
				value: resolvedValue,
				damageType: this.damageType,
				appliesTo: this.appliesTo,
			},
		]);
	}
}

export { DamageBonusRule, type DamageBonusEntry, type DamageBonusTarget };
