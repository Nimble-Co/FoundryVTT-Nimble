import type { AttackOutcomeSources, ForcedCritKind } from '#types/attackOutcome.d.ts';
import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { AttackOutcomeChange } from '../../models/rules/attackOutcome.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import type { AttackDelivery } from './attackDelivery.js';

interface AttackOutcomeRuleLike {
	type?: string;
	changeFor?(context: {
		side: 'yourAttacks' | 'attacksAgainstYou';
		delivery: AttackDelivery | null;
		other: OtherCreature | null | undefined;
		itemUuid: string | null | undefined;
		damageTypes?: readonly string[];
	}): AttackOutcomeChange | null;
}

interface RuleOwner {
	rules?: unknown;
}

/** One attack, as the Attack Outcome rules see it when it is rolled. */
interface AttackOutcomeInput {
	attacker: RuleOwner | null | undefined;
	/** The target, when the attack has exactly one. */
	target: RuleOwner | null | undefined;
	delivery: AttackDelivery | null;
	itemUuid: string | null | undefined;
	canCrit: boolean;
	canMiss: boolean;
	/** The damage types of the attack. */
	damageTypes?: readonly string[];
}

/** The roll options the Attack Outcome rules give, and the charges the attacker's rules spend. */
interface AttackOutcome {
	options: {
		canMiss: boolean;
		critRange?: number;
		forcedCrit?: ForcedCritKind;
		anyDieCrits?: boolean;
		outcomeSources?: Partial<AttackOutcomeSources>;
	};
	charges: string[];
}

function rulesOf(owner: RuleOwner | null | undefined): AttackOutcomeRuleLike[] {
	const rules = owner?.rules;
	if (!rules || typeof (rules as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
	return Array.from(rules as Iterable<AttackOutcomeRuleLike>).filter(
		(rule) => rule?.type === 'attackOutcome' && typeof rule.changeFor === 'function',
	);
}

/**
 * Reads the Attack Outcome rules of the one who attacks and of the target for
 * one attack. Any "cannot miss" wins, the largest crit range wins, and an
 * "always" Forced Crit beats one on a hit. A roll that cannot crit takes no
 * crit change, and one that cannot miss takes no "cannot miss". With Feature
 * Effects off, a rule that gives a crit does not give it here. A rule that
 * gives nothing to this roll spends no charge.
 */
export function collectAttackOutcome(input: AttackOutcomeInput): AttackOutcome {
	const automatic = isRuleAutomationEnabled();
	const sources: AttackOutcomeSources = {
		cannotMiss: [],
		critRange: [],
		forcedCrit: [],
		anyDieCrits: [],
	};
	const charges: string[] = [];
	let critRange = 0;
	let forcedCrit: ForcedCritKind | null = null;

	const sides = [
		{ side: 'yourAttacks' as const, owner: input.attacker, other: input.target },
		{ side: 'attacksAgainstYou' as const, owner: input.target, other: input.attacker },
	];
	for (const { side, owner, other } of sides) {
		for (const rule of rulesOf(owner)) {
			const change = rule.changeFor?.({
				side,
				delivery: input.delivery,
				other: other as OtherCreature | null | undefined,
				itemUuid: input.itemUuid,
				damageTypes: input.damageTypes ?? [],
			});
			if (!change) continue;

			let gives = false;
			if (change.cannotMiss && input.canMiss) {
				sources.cannotMiss.push(change.label);
				gives = true;
			}
			if (input.canCrit && change.critRange > 0) {
				sources.critRange.push(change.label);
				critRange = Math.max(critRange, change.critRange);
				gives = true;
			}
			if (input.canCrit && automatic && change.forcedCrit) {
				sources.forcedCrit.push(change.label);
				if (forcedCrit !== 'always') forcedCrit = change.forcedCrit;
				gives = true;
			}
			if (input.canCrit && automatic && change.anyDieCrits) {
				sources.anyDieCrits.push(change.label);
				gives = true;
			}
			if (gives && change.chargePoolIdentifier) charges.push(change.chargePoolIdentifier);
		}
	}

	const options: AttackOutcome['options'] = {
		canMiss: input.canMiss && sources.cannotMiss.length === 0,
	};
	if (critRange > 0) options.critRange = critRange;
	if (forcedCrit) options.forcedCrit = forcedCrit;
	if (sources.anyDieCrits.length > 0) options.anyDieCrits = true;
	const named = Object.entries(sources).filter(([, labels]) => labels.length > 0);
	if (named.length > 0) options.outcomeSources = Object.fromEntries(named);
	return { options, charges };
}
