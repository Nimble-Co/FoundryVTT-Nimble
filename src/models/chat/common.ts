import { DIE_OUTCOMES, REROLL_SIDES, REROLL_TRIGGERS } from '../../utils/incomingReactionEntry.js';

const { fields } = foundry.data;

export const metadata = () => ({
	actorName: new fields.StringField({ required: true, initial: '', nullable: false }),
	actorType: new fields.StringField({ required: true, initial: '', nullable: false }),
	image: new fields.StringField({ required: true, initial: '', nullable: false }),
	permissions: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	rollMode: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true }),
});

/** The actor that made a check, and its token when it has one. */
export const roller = () => ({
	actorUuid: new fields.StringField({ required: false, nullable: true, initial: null }),
	tokenUuid: new fields.StringField({ required: false, nullable: true, initial: null }),
});

/** Whether the activated item made its user concentrate. */
export const concentration = () => ({
	concentration: new fields.BooleanField({ required: true, initial: false, nullable: false }),
});

export const targets = () => ({
	targets: new fields.ArrayField(new fields.StringField({ required: true, nullable: false }), {
		required: true,
		nullable: false,
		initial: [],
	}),
});

/** Schema for tracking applied healing/damage on activation cards */
export const appliedHealing = () => ({
	appliedHealing: new fields.ObjectField({ required: false, nullable: false, initial: {} }),
});

/**
 * Pending granted-activation offers (e.g. "a targeted ally may immediately
 * make a weapon attack"). Stamped onto the card by the activating client from
 * the used item's grantActivation rules. Offers carry no expiry — like the
 * incoming reactions below, they remain available until used.
 */
export const grantedActionOffers = () => ({
	grantedActionOffers: new fields.ArrayField(
		new fields.SchemaField({
			id: new fields.StringField({ required: true, nullable: false, initial: '' }),
			targetActorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			label: new fields.StringField({ required: true, nullable: false, initial: '' }),
			activationType: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'weaponAttack',
				choices: ['weaponAttack'],
			}),
			ruleId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			sourceItemUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			used: new fields.BooleanField({ required: true, nullable: false, initial: false }),
			usedBy: new fields.StringField({ required: false, nullable: true, initial: null }),
		}),
		{ required: true, nullable: false, initial: [] },
	),
});

/**
 * Movement Offers made by this card's `move` effect nodes, one per node and
 * recipient, stamped when the card is posted or a target is added. The active
 * GM settles each one after the recipient's next Movement, lapses it when the
 * combat turn ends, or untracks it when a toggle that gates offers changes.
 */
export const movementOffers = () => ({
	movementOffers: new fields.ArrayField(
		new fields.SchemaField({
			id: new fields.StringField({ required: true, nullable: false, initial: '' }),
			nodeId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			tokenUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			name: new fields.StringField({ required: true, nullable: false, initial: '' }),
			kind: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'free',
				choices: ['free', 'forced'],
			}),
			spaces: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
			ignoreDifficultTerrain: new fields.BooleanField({
				required: true,
				nullable: false,
				initial: false,
			}),
			state: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'open',
				choices: ['open', 'taken', 'unused', 'lapsed', 'untracked'],
			}),
			usedBy: new fields.StringField({ required: false, nullable: true, initial: null }),
			movedSpaces: new fields.NumberField({
				required: false,
				nullable: true,
				initial: null,
				integer: true,
				min: 0,
			}),
			stopped: new fields.BooleanField({ required: true, nullable: false, initial: false }),
			conditional: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		}),
		{ required: true, nullable: false, initial: [] },
	),
});

/**
 * Pending interactive offers stamped onto an attack card: defender-side
 * reactions (redirect to self), rerolls from either side, and attacker-side
 * spends such as `spendPoolForDamage`. Snapshotted at card creation by the
 * attacker's client; `kind` is an open extension point for future offer types.
 *
 * `forceReroll`, `rerollTrigger` and `rerollWithDisadvantage` are legacy: old
 * cards still hold them, so the schema accepts them, but nothing makes them.
 */
export const incomingReactions = () => ({
	incomingReactions: new fields.ArrayField(
		new fields.SchemaField({
			id: new fields.StringField({ required: true, nullable: false, initial: '' }),
			kind: new fields.StringField({
				required: true,
				nullable: false,
				choices: ['forceReroll', 'redirectToSelf', 'spendPoolForDamage', 'reroll'],
			}),
			source: new fields.StringField({
				required: true,
				nullable: false,
				initial: 'rule',
				choices: ['baseline', 'rule'],
			}),
			actorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			tokenUuid: new fields.StringField({ required: false, nullable: true, initial: null }),
			targetTokenUuid: new fields.StringField({ required: false, nullable: true, initial: null }),
			label: new fields.StringField({ required: true, nullable: false, initial: '' }),
			ruleId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			itemUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			used: new fields.BooleanField({ required: true, nullable: false, initial: false }),
			side: new fields.StringField({
				required: false,
				nullable: true,
				initial: null,
				choices: [...REROLL_SIDES],
			}),
			oncePerAttack: new fields.BooleanField({ required: false, nullable: false, initial: false }),
			// Legacy forceReroll fields, kept so old cards validate.
			rerollTrigger: new fields.StringField({
				required: false,
				nullable: false,
				initial: 'always',
				choices: ['always', 'hit', 'criticalHit'],
			}),
			rerollWithDisadvantage: new fields.BooleanField({
				required: false,
				nullable: false,
				initial: false,
			}),
			// Gate on the attack's resolved outcome, applied before the offer is
			// stamped.
			outcomeTrigger: new fields.StringField({
				required: false,
				nullable: true,
				initial: null,
				choices: [...REROLL_TRIGGERS],
			}),
			// What a spend offer did once used, as components rather than a
			// sentence: the attribution line is localized at render time, so a
			// note written by an English client must not render in English
			// everywhere else.
			usedAmount: new fields.NumberField({ required: false, nullable: true, initial: null }),
			usedPoolLabel: new fields.StringField({ required: false, nullable: false, initial: '' }),
			usedFaces: new fields.ArrayField(
				new fields.NumberField({ required: true, nullable: false }),
				{ required: false, nullable: false, initial: [] },
			),
		}),
		{ required: true, nullable: false, initial: [] },
	),
});

const rerollDieResult = () =>
	new fields.SchemaField(
		{
			value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
			outcome: new fields.StringField({
				required: true,
				nullable: true,
				initial: null,
				choices: [...DIE_OUTCOMES],
			}),
		},
		{ required: true, nullable: true, initial: null },
	);

/**
 * The rerolls of an attack card's last action, for its history lines, and
 * whether a discarded crit still triggers when-crit abilities. A new action
 * replaces `rerolls`; `discardedCritTriggers` stays on once set.
 */
export const rerollHistory = () => ({
	rerolls: new fields.ArrayField(
		new fields.SchemaField({
			entryId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			itemUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			ruleId: new fields.StringField({ required: true, nullable: false, initial: '' }),
			label: new fields.StringField({ required: true, nullable: false, initial: '' }),
			actorUuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
			faces: new fields.NumberField({ required: true, nullable: true, initial: null }),
			previous: rerollDieResult(),
			next: rerollDieResult(),
			usesLeft: new fields.NumberField({ required: true, nullable: true, initial: null }),
			woundsGained: new fields.NumberField({
				required: true,
				nullable: false,
				initial: 0,
				integer: true,
				min: 0,
			}),
		}),
		{ required: false, nullable: false, initial: [] },
	),
	discardedCritTriggers: new fields.BooleanField({
		required: false,
		nullable: false,
		initial: false,
	}),
});
