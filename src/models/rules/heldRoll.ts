import { NimbleBaseRule } from './base.js';

export const HELD_ROLL_KINDS = [
	'advantage',
	'primaryDie',
	'wholeAmount',
	'ignoreDisadvantage',
	'mustAttackOther',
	'vulnerableOnce',
	'maximize',
] as const;

const WORDS = 'NIMBLE.rules.heldRoll';

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
		value: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			initial: 1,
			label: `${WORDS}.value.label`,
			hint: `${WORDS}.value.hint`,
		}),
		appliesTo: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'holderAttacks',
			choices: {
				holderAttacks: `${WORDS}.appliesTo.choices.holderAttacks`,
				attacksOnHolder: `${WORDS}.appliesTo.choices.attacksOnHolder`,
			},
			label: `${WORDS}.appliesTo.label`,
			hint: `${WORDS}.appliesTo.hint`,
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
		fromSourceOnly: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `${WORDS}.fromSourceOnly.label`,
			hint: `${WORDS}.fromSourceOnly.hint`,
		}),
		damageType: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			choices: () => CONFIG.NIMBLE.damageTypes,
			label: `${WORDS}.damageType.label`,
			hint: `${WORDS}.damageType.hint`,
		}),
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

	static override defineSchema(): HeldRollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { HeldRollRule };
