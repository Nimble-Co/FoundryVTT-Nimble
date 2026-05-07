import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type DamageBonusDelivery = 'melee' | 'ranged' | 'any';
type DamageBonusSource = 'weapon' | 'spell' | 'any';

interface DamageBonusEntry {
	/** Resolved numeric value (null when the bonus is dice-based) */
	value: number | null;
	/** Raw dice formula to append to the roll (null when the bonus is numeric) */
	formula: string | null;
	damageType: string;
	delivery: DamageBonusDelivery;
	source: DamageBonusSource;
}

/** Matches dice notation: 1d6, 2d8, 3d20+5, 1d4+@level, etc. Uses negative lookbehind
 *  to avoid matching identifiers like "id6" while still matching "1d6" and bare "d20". */
const DICE_PATTERN = /(?<![a-zA-Z])d\d+/i;

function schema() {
	const { fields } = foundry.data;

	return {
		// `value` accepts both numeric formulas (`@level`, `5`) and dice expressions
		// (`1d6`, `2d8+5`). The `formula` widget is a free text input — see ADR-003.
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '@level',
				label: 'Bonus',
				hint: 'Flat (5), formula (@level), or dice (1d6+2).',
				widget: 'formula',
			}),
		),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			// `blank: true` is explicit because adding `choices` flips Foundry's
			// blank default to false — but the empty string is the "no specific
			// damage type" sentinel here (matches everything during activation).
			blank: true,
			initial: '',
			label: 'Damage type',
			hint: 'Restrict to attacks of this type. Leave blank to match all.',
			choices: () => CONFIG.NIMBLE.damageTypes,
		}),
		delivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: 'Delivery',
			hint: 'Restrict to melee or ranged attacks. “Any” matches both.',
			choices: ['melee', 'ranged', 'any'],
		}),
		source: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: 'Source',
			hint: 'Restrict to weapon or spell attacks. “Any” matches both.',
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
 * Values can be either numeric formulas (@level, @abilities.will.mod, 5) which resolve to
 * a number during data prep, or dice expressions (1d6, 2d8) which are stored as raw formula
 * strings and appended to the damage roll at activation time.
 *
 * Bonuses are accumulated in an array on the actor and filtered during item activation.
 * An optional damageType field restricts the bonus to attacks dealing that damage type.
 */
class DamageBonusRule extends NimbleBaseRule<DamageBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.ruleDescriptions.damageBonus';

	declare value: string;
	// `damageType` is inferred from the schema's `choices` (the keys of
	// `CONFIG.NIMBLE.damageTypes`, plus `''` for the no-filter sentinel).
	// No explicit declare — re-declaring as the wider `string` clashes with
	// the narrower inferred initialized type.
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
	 * Check if the value contains dice notation (e.g. 1d6, 2d8+5).
	 */
	private isDiceFormula(): boolean {
		return DICE_PATTERN.test(this.value);
	}

	/**
	 * Push a bonus entry to the actor's damageBonuses array,
	 * initializing the array if it doesn't exist.
	 */
	private pushBonus(entry: DamageBonusEntry): void {
		const { actor } = this.item;
		const actorSystem = actor as object as ActorSystem;
		if (!actorSystem.system.damageBonuses) {
			foundry.utils.setProperty(actor.system, 'damageBonuses', []);
		}
		actorSystem.system.damageBonuses!.push(entry);
	}

	/**
	 * Apply the damage bonus to the actor.
	 * Bonuses are pushed to an array so multiple rules stack correctly.
	 * Dice-based values are stored as raw formulas; numeric values are resolved.
	 */
	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		if (this.isDiceFormula()) {
			// Dice expression — store raw formula, don't resolve to a number
			this.pushBonus({
				value: null,
				formula: this.value,
				damageType: this.damageType,
				delivery: this.delivery,
				source: this.source,
			});
		} else {
			// Numeric formula — resolve to a number
			const resolvedValue = this.resolveFormula(this.value);
			if (resolvedValue === null || resolvedValue <= 0) return;

			this.pushBonus({
				value: resolvedValue,
				formula: null,
				damageType: this.damageType,
				delivery: this.delivery,
				source: this.source,
			});
		}
	}
}

export { DamageBonusRule, type DamageBonusEntry, type DamageBonusDelivery, type DamageBonusSource };
