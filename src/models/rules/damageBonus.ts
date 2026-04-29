import { NimbleBaseRule } from './base.js';

type DamageBonusDelivery = 'melee' | 'ranged' | 'any';
type DamageBonusSource = 'weapon' | 'spell' | 'any';

interface DamageBonusEntry {
	value: number;
	damageType: string;
	delivery: DamageBonusDelivery;
	source: DamageBonusSource;
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
			initial: '',
		}),
		delivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: ['melee', 'ranged', 'any'],
		}),
		source: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: ['weapon', 'spell', 'any'],
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
 * Rule that adds bonus damage to attacks, scoped by delivery method and source type.
 *
 * Delivery (melee | ranged | any) — how the attack reaches the target.
 * Source (weapon | spell | any) — what produces the attack.
 *
 * These are independent axes: a melee spell (Shocking Grasp) has delivery=melee, source=spell.
 * A ranged weapon (bow) has delivery=ranged, source=weapon.
 *
 * Bonuses are accumulated in an array on the actor and filtered during item activation.
 * An optional damageType field restricts the bonus to attacks dealing that damage type.
 */
class DamageBonusRule extends NimbleBaseRule<DamageBonusRule.Schema> {
	declare value: string;
	declare damageType: string;
	declare delivery: DamageBonusDelivery;
	declare source: DamageBonusSource;

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
				['delivery', 'string'],
				['source', 'string'],
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
		if (!actorSystem.system.damageBonuses) {
			foundry.utils.setProperty(actor.system, 'damageBonuses', []);
		}

		actorSystem.system.damageBonuses!.push({
			value: resolvedValue,
			damageType: this.damageType,
			delivery: this.delivery,
			source: this.source,
		});
	}
}

export { DamageBonusRule, type DamageBonusEntry, type DamageBonusDelivery, type DamageBonusSource };
