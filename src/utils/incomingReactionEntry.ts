/**
 * When an outcome-gated offer or reroll applies, given how the attack landed.
 * `hit` includes crits; `nonCriticalHit` is a hit that is not a crit.
 */
export type RerollTrigger = 'always' | 'hit' | 'criticalHit' | 'nonCriticalHit' | 'miss';

/** The side of a roll a `reroll` entry is for. */
export type RerollSide = 'roller' | 'target';

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

/**
 * A pending interactive offer stamped onto an attack chat card. Entries are
 * snapshotted on the attacker's client at card creation so every client sees
 * the same offer; executors revalidate lightly on use.
 *
 * Most kinds are defender-side reactions to the attack. `spendPoolForDamage`
 * is attacker-side: the attacker spends their own dice pool into this card's
 * damage total. `reroll` comes from a Reroll rule of either the attacker or
 * the target.
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
	/** Protector's token (redirect only) */
	tokenUuid: string | null;
	/** Token whose targeting the redirect replaces (redirect, and target-side rerolls) */
	targetTokenUuid: string | null;
	label: string;
	ruleId: string;
	itemUuid: string;
	used: boolean;
	/** reroll only: the side of the roll the entry was stamped for */
	side?: RerollSide;
	/** forceReroll only: gate the offer/execution on the roll's outcome */
	rerollTrigger?: RerollTrigger;
	/** forceReroll only: roll the reroll at disadvantage */
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

/**
 * The last reroll on an attack card, for its history line. Each reroll
 * replaces it: only the result just before the current one is shown.
 */
export interface LastReroll {
	entryId: string;
	itemUuid: string;
	label: string;
	/** The actor whose feature made the reroll */
	actorUuid: string;
	previousResult: number | null;
	previousWasCritical: boolean;
	newResult: number | null;
	/** Charges left in the feature's charge pool, or null when it has none */
	usesLeft: number | null;
	woundsGained: number;
}
