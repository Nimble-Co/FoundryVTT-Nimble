const { fields } = foundry.data;

export const metadata = () => ({
	actorName: new fields.StringField({ required: true, initial: '', nullable: false }),
	actorType: new fields.StringField({ required: true, initial: '', nullable: false }),
	image: new fields.StringField({ required: true, initial: '', nullable: false }),
	permissions: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
	rollMode: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true }),
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
 * Pending interactive offers stamped onto an attack card. Mostly defender-side
 * reactions (force reroll, redirect to self), plus attacker-side spends such as
 * `spendPoolForDamage`. Snapshotted at card creation by the attacker's client;
 * `kind` is an open extension point for future offer types.
 */
export const incomingReactions = () => ({
	incomingReactions: new fields.ArrayField(
		new fields.SchemaField({
			id: new fields.StringField({ required: true, nullable: false, initial: '' }),
			kind: new fields.StringField({
				required: true,
				nullable: false,
				choices: ['forceReroll', 'redirectToSelf', 'spendPoolForDamage'],
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
			// forceReroll offers carry their reroll semantics so the executor can
			// honor them on click.
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
			// stamped. Distinct from `rerollTrigger`, which also governs whether an
			// *automatic* reroll executes; this only decides whether an offer is
			// worth showing.
			outcomeTrigger: new fields.StringField({
				required: false,
				nullable: true,
				initial: null,
				choices: ['always', 'hit', 'criticalHit'],
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
