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
 * Pending interactive incoming-attack reactions (force reroll, redirect to
 * self). Snapshotted at card creation by the attacker's client; `kind` is an
 * open extension point for future reaction types.
 */
export const incomingReactions = () => ({
	incomingReactions: new fields.ArrayField(
		new fields.SchemaField({
			id: new fields.StringField({ required: true, nullable: false, initial: '' }),
			kind: new fields.StringField({
				required: true,
				nullable: false,
				choices: ['forceReroll', 'redirectToSelf'],
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
		}),
		{ required: true, nullable: false, initial: [] },
	),
});
