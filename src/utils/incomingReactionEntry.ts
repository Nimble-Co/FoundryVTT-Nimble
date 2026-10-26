/**
 * When an outcome-gated offer or reroll applies, given how the attack landed.
 * `hit` includes crits; `nonCriticalHit` is a hit that is not a crit.
 */
export const REROLL_TRIGGERS = ['always', 'hit', 'criticalHit', 'nonCriticalHit', 'miss'] as const;
export type RerollTrigger = (typeof REROLL_TRIGGERS)[number];

/** The side of a roll a `reroll` entry is for. */
export const REROLL_SIDES = ['roller', 'target', 'ally'] as const;
export type RerollSide = (typeof REROLL_SIDES)[number];

/** Which dice a reroll rolls again. */
export const REROLL_DICE = ['wholeRoll', 'primaryDie', 'pickedDie'] as const;
export type RerollDie = (typeof REROLL_DICE)[number];

/** Which result stands after a reroll. */
export const REROLL_KEEPS = ['new', 'rollerChooses', 'ownerChooses'] as const;
export type RerollKeep = (typeof REROLL_KEEPS)[number];

/** How one die result counts: a crit, a miss, or neither (null). */
export const DIE_OUTCOMES = ['crit', 'miss'] as const;
export type DieOutcome = (typeof DIE_OUTCOMES)[number] | null;

/**
 * The outcome fields a trigger is checked against. An evaluated DamageRoll
 * satisfies this, and so does a posted card's own system data, which is what
 * the GM-side executors re-check against.
 */
export interface AttackOutcomeView {
	isCritical?: boolean;
	isMiss?: boolean;
}

/** Does the attack's outcome satisfy a trigger? */
export function rerollTriggerMatches(
	trigger: RerollTrigger | null | undefined,
	view: AttackOutcomeView,
): boolean {
	switch (trigger) {
		case 'criticalHit':
			return !!view.isCritical;
		case 'hit':
			return !view.isMiss;
		case 'nonCriticalHit':
			return !view.isMiss && !view.isCritical;
		case 'miss':
			return !!view.isMiss;
		default:
			return true; // 'always'
	}
}

export const REROLL_LEFT_OUT_REASONS = ['disposition', 'reach'] as const;

/** Why an ally-side reroll was left out when the card was posted. */
export type RerollLeftOut =
	| { reason: 'disposition' }
	| { reason: 'reach'; spaces: number; reach: number };

/**
 * A pending interactive offer stamped onto an attack chat card. Entries are
 * snapshotted on the attacker's client at card creation so every client sees
 * the same offer; executors revalidate lightly on use.
 *
 * Most kinds are defender-side reactions to the attack. `spendPoolForDamage`
 * is attacker-side: the attacker spends their own dice pool into this card's
 * damage total. `reroll` comes from a Reroll rule of the one who rolled,
 * the target, or an ally of the one who rolled. `forceReroll` is a legacy stored kind: old cards still hold it,
 * but nothing makes or resolves it any more.
 *
 * Lives apart from `incomingAttackModifiers` so the modules that only build
 * entries (e.g. `poolSpendCardOffers`) do not have to depend on the module
 * that consumes them.
 */
export interface IncomingReactionEntry {
	id: string;
	kind: 'forceReroll' | 'redirectToSelf' | 'spendPoolForDamage' | 'reroll';
	/** `baseline` = universal heroic Interpose; `rule` = granted by a rule */
	source: 'baseline' | 'rule';
	/** Acting actor (token-actor uuid, so unlinked tokens resolve) */
	actorUuid: string;
	/** Protector's token (redirect), or the ally's token (ally-side rerolls) */
	tokenUuid: string | null;
	/** Token whose targeting the redirect replaces (redirect, and target-side rerolls) */
	targetTokenUuid: string | null;
	label: string;
	ruleId: string;
	itemUuid: string;
	used: boolean;
	/** reroll only: the side of the roll the entry was stamped for */
	side?: RerollSide;
	/** reroll only: the rule gives no new entry after it is used on this card */
	oncePerAttack?: boolean;
	/** Ally-side reroll only: why the scan left it out. Null when it counts. */
	leftOut?: RerollLeftOut | null;
	/** Legacy `forceReroll` field. Old cards hold it; nothing reads it. */
	rerollTrigger?: RerollTrigger;
	/** Legacy `forceReroll` field. Old cards hold it; nothing reads it. */
	rerollWithDisadvantage?: boolean;
	/**
	 * Gate on the attack's resolved outcome. Checked before stamping, again
	 * whenever a reroll changes the card's outcome, and once more on the GM
	 * client before the offer executes. Absent means always.
	 */
	outcomeTrigger?: RerollTrigger | null;
	/**
	 * What a `spendPoolForDamage` offer did, as components. Kept unformatted so
	 * the card's attribution line can be localized on the client that renders
	 * it rather than on the client that spent.
	 */
	usedAmount?: number | null;
	usedPoolLabel?: string;
	usedFaces?: number[];
}

/** One Primary Die result in a reroll record. */
export interface RerollDieResult {
	value: number;
	outcome: DieOutcome;
}

/**
 * One reroll on an attack card, for its history line. The card keeps the
 * rerolls of its last action in roll order.
 */
export interface RerollRecord {
	entryId: string;
	itemUuid: string;
	ruleId: string;
	label: string;
	/** The actor whose feature made the reroll */
	actorUuid: string;
	/** The Primary Die size, or null when it cannot be read */
	faces: number | null;
	/** The replaced Primary Die result, or null when it cannot be read */
	previous: RerollDieResult | null;
	/** The new Primary Die result, or null when it cannot be read */
	next: RerollDieResult | null;
	/** Charges left in the feature's charge pool, or null when it has none */
	usesLeft: number | null;
	woundsGained: number;
	/** Which result a player kept, when the rule let them choose. */
	kept?: RerollKept | null;
	/** The total of the kept roll, when a player chose. */
	keptTotal?: number | null;
}

export const REROLL_KEPT = ['new', 'old'] as const;
export type RerollKept = (typeof REROLL_KEPT)[number];

export const KEEP_OUTCOMES = ['crit', 'hit', 'miss'] as const;

/** A roll a player can keep, as its Keep button shows it. */
export interface KeepChoiceRoll {
	total: number;
	/** Null for a roll that has no hit or miss, such as a save. */
	outcome: (typeof KEEP_OUTCOMES)[number] | null;
}

/**
 * A reroll whose new roll waits for a player to keep it or the old one. The
 * card still shows the old roll.
 */
export interface PendingKeep {
	entryId: string;
	/** The actor whose owner chooses. */
	chooserUuid: string;
	/** The new roll, serialized. */
	roll: Record<string, unknown>;
	reroll: RerollRecord;
	old: KeepChoiceRoll;
	new: KeepChoiceRoll;
	/** What `discardedCritTriggers` becomes if the new roll is kept. */
	discardedCritTriggers: boolean;
}
