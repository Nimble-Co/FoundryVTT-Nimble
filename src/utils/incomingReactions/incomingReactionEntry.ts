import type { DieChange } from '#types/dieChange.d.ts';

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

/** What a `reroll` entry does: roll again, change a die, or make the attack a crit. */
export const ROLL_USES = ['reroll', 'change', 'crit'] as const;
export type RollUse = (typeof ROLL_USES)[number];

/** The dice a Change a Die rule can change. */
export type ChangeableDie = Exclude<RerollDie, 'wholeRoll'>;

/** How a Change a Die rule changes the die: set it to a face, or add a number. */
export const DIE_CHANGE_MODES = ['set', 'add'] as const;
export type DieChangeMode = (typeof DIE_CHANGE_MODES)[number];

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
	/** A Forced Crit that always applies: no reroll or change takes the crit away. */
	critStays?: boolean;
	/** False when the roll cannot crit. Absent: read from `options`, else it can. */
	canCrit?: boolean;
	/** The options of a rolled attack, when the view is the roll. */
	options?: { canCrit?: unknown; forcedCrit?: unknown } | null;
	/** A die of the roll is at its max. Absent: read from `terms`. */
	anyDieAtMax?: boolean;
	/** The terms of a rolled attack, when the view is the roll. */
	terms?: readonly unknown[];
}

/** Whether a kept die of these terms is at its max. */
export function termsHaveDieAtMax(terms: readonly unknown[] | null | undefined): boolean {
	return (terms ?? []).some((term) => {
		const die = term as {
			faces?: unknown;
			results?: Array<{ result: number; active?: boolean; discarded?: boolean }>;
		};
		return (
			typeof die?.faces === 'number' &&
			Array.isArray(die.results) &&
			die.results.some((r) => r.active !== false && !r.discarded && r.result === die.faces)
		);
	});
}

/** Whether a die of the attack is at its max. */
export function hasDieAtMax(view: AttackOutcomeView): boolean {
	return view.anyDieAtMax ?? termsHaveDieAtMax(view.terms);
}

/** Whether the attack is a crit that no reroll or change takes away. */
export function critStays(view: AttackOutcomeView): boolean {
	if (view.isCritical !== true) return false;
	return view.critStays ?? view.options?.forcedCrit === 'always';
}

/** Whether the attack is not a crit and can still be made one. */
export function canBecomeCrit(view: AttackOutcomeView): boolean {
	if (view.isCritical === true) return false;
	return (view.canCrit ?? view.options?.canCrit) !== false;
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
	/** reroll only: `change` for a Change a Die rule, `crit` for Make It a Crit. Absent is `reroll`. */
	use?: RollUse;
	/** reroll only: a crit use that also needs a die of the roll at its max. */
	needsDieAtMax?: boolean;
	/** reroll only: the rule's note under the feature on the card. */
	hint?: string;
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
	/** The other result of a die rerolled two times for advantage or disadvantage. */
	dropped?: number | null;
	/** The roll changes of Modify Reroll rules this reroll applied. */
	changes?: RollChange[];
	/** What creatures got from this use. */
	grants?: RerollGrant[];
	/** The rule rerolled by itself, with no click. */
	automatic?: boolean;
	/** `change` for a die a Change a Die rule changed, `crit` for Make It a Crit. Absent is `reroll`. */
	use?: RollUse;
	/** A change only: how the die changed. `value` is 0 for a set value. */
	change?: DieChange | null;
}

/**
 * A roll change a Modify Reroll rule adds to a reroll. `key` makes it count
 * once per card. `value` is the roll mode step, or the extra damage.
 */
export interface RollChange {
	key: string;
	kind: 'rollMode' | 'extraDamage';
	label: string;
	value: number;
}

/** What one creature got from a use of a reroll. */
export interface RerollGrant {
	actorUuid: string;
	name: string;
	/** `had` is the creature's temp HP before; `keeps` is that amount when it is not less than `amount`. */
	tempHp: { amount: number; had: number; keeps: number | null; source: string } | null;
	actions: {
		amount: number;
		reason: 'notInCombat' | 'notACharacter' | null;
		source: string;
	} | null;
	/** False when Feature Effects is off: the GM applies it by hand. */
	applied: boolean;
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
