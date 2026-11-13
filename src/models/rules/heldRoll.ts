import localize from '#utils/localize.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const HELD_ROLL_KINDS = [
	'advantage',
	'primaryDie',
	'wholeAmount',
	'ignoreDisadvantage',
	'mustAttackOther',
	'vulnerableOnce',
	'maximize',
	'extraDamage',
] as const;

const WORDS = 'NIMBLE.rules.heldRoll';

const KINDS_WITH_A_VALUE = new Set(['advantage', 'primaryDie', 'wholeAmount']);

const kindHasValue = (data: Record<string, unknown>) =>
	KINDS_WITH_A_VALUE.has(String(data.heldKind));
const hasDamageType = (data: Record<string, unknown>) =>
	data.heldKind === 'vulnerableOnce' || data.heldKind === 'extraDamage';
const isExtraDamage = (data: Record<string, unknown>) => data.heldKind === 'extraDamage';
const isOnHolder = (data: Record<string, unknown>) => data.whichRoll === 'attacksOnHolder';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'heldRoll' }),
		heldKind: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'advantage',
			choices: Object.fromEntries(
				HELD_ROLL_KINDS.map((kind) => [kind, `${WORDS}.heldKind.choices.${kind}`]),
			),
			label: `${WORDS}.heldKind.label`,
			hint: `${WORDS}.heldKind.hint`,
		}),
		value: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				initial: 1,
				label: `${WORDS}.value.label`,
				hint: `${WORDS}.value.hint`,
				showWhen: kindHasValue,
			}),
		),
		whichRoll: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'holderAttacks',
			choices: {
				holderAttacks: `${WORDS}.whichRoll.choices.holderAttacks`,
				attacksOnHolder: `${WORDS}.whichRoll.choices.attacksOnHolder`,
			},
			label: `${WORDS}.whichRoll.label`,
			hint: `${WORDS}.whichRoll.hint`,
		}),
		usedUp: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: true,
			label: `${WORDS}.usedUp.label`,
			hint: `${WORDS}.usedUp.hint`,
		}),
		meleeOnly: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `${WORDS}.meleeOnly.label`,
			hint: `${WORDS}.meleeOnly.hint`,
		}),
		fromSourceOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: `${WORDS}.fromSourceOnly.label`,
				hint: `${WORDS}.fromSourceOnly.hint`,
				showWhen: isOnHolder,
			}),
		),
		damageType: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				choices: () => CONFIG.NIMBLE.damageTypes,
				label: `${WORDS}.damageType.label`,
				hint: `${WORDS}.damageType.hint`,
				showWhen: hasDamageType,
			}),
		),
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				widget: 'formula',
				label: `${WORDS}.formula.label`,
				hint: `${WORDS}.formula.hint`,
				showWhen: isExtraDamage,
			}),
		),
	};
}

declare namespace HeldRollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A change to a later roll that the effect holds: the holder's own next attack, or the next attack
 * against the holder. The roll that uses it ends the effect when `usedUp`; the effect's Lasts Until
 * ends it in time. It does nothing on an item.
 */
class HeldRollRule extends NimbleBaseRule<HeldRollRule.Schema> {
	static override worksOnItems = false;

	static override group = 'bonuses';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-hourglass-half';

	/** An upcast raise of `value` adds steps of advantage, or to the Primary Die or the set amount. */
	static override raisedFieldLabel(field: string, rule: Record<string, unknown>): string | null {
		if (field !== 'value' || !KINDS_WITH_A_VALUE.has(String(rule.heldKind))) return null;
		return localize(`${WORDS}.raised.${String(rule.heldKind)}`);
	}

	static override defineSchema(): HeldRollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { HeldRollRule };
