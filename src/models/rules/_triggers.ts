/** Attacks that the rule's actor makes, by their outcome. */
const ATTACK_OUTCOME_TRIGGERS = ['onHit', 'onCrit', 'onMiss'] as const;

/** Things that happen to the rule's actor. */
const SELF_TRIGGERS = [
	'onTurnStart',
	'onTurnEnd',
	'onKill',
	'onWound',
	'onSaveFail',
	'onRest',
	'onInitiative',
	'onCritReceived',
	'onDying',
] as const;

/** The events a trigger rule can act on. */
const RULE_TRIGGERS = [...ATTACK_OUTCOME_TRIGGERS, ...SELF_TRIGGERS] as const;

type RuleTrigger = (typeof RULE_TRIGGERS)[number];
type AttackOutcomeTrigger = (typeof ATTACK_OUTCOME_TRIGGERS)[number];

function isAttackOutcomeTrigger(trigger: string): trigger is AttackOutcomeTrigger {
	return (ATTACK_OUTCOME_TRIGGERS as readonly string[]).includes(trigger);
}

/** Whether an attack outcome is the one the trigger names. */
function attackOutcomeMatches(
	trigger: string,
	outcome: { isCritical: boolean; isMiss: boolean },
): boolean {
	if (trigger === 'onHit') return !outcome.isCritical && !outcome.isMiss;
	if (trigger === 'onCrit') return outcome.isCritical;
	if (trigger === 'onMiss') return outcome.isMiss;
	return false;
}

export { attackOutcomeMatches, isAttackOutcomeTrigger, RULE_TRIGGERS, type RuleTrigger };
