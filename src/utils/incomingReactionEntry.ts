/** When an outcome-gated offer or reroll applies, given how the attack landed. */
export type RerollTrigger = 'always' | 'hit' | 'criticalHit';

/**
 * A pending interactive offer stamped onto an attack chat card. Entries are
 * snapshotted on the attacker's client at card creation so every client sees
 * the same offer; executors revalidate lightly on use.
 *
 * Most kinds are defender-side reactions to the attack. `spendPoolForDamage`
 * is attacker-side: the attacker spends their own dice pool into this card's
 * damage total.
 *
 * Lives apart from `incomingAttackModifiers` so the modules that only build
 * entries (e.g. `poolSpendCardOffers`) do not have to depend on the module
 * that consumes them.
 */
export interface IncomingReactionEntry {
	id: string;
	kind: 'forceReroll' | 'redirectToSelf' | 'spendPoolForDamage';
	/** `baseline` = universal heroic Interpose; `rule` = granted by a rule */
	source: 'baseline' | 'rule';
	/** Acting actor (token-actor uuid, so unlinked tokens resolve) */
	actorUuid: string;
	/** Protector's token (redirect only) */
	tokenUuid: string | null;
	/** Token whose targeting the redirect replaces (redirect only) */
	targetTokenUuid: string | null;
	label: string;
	ruleId: string;
	itemUuid: string;
	used: boolean;
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
