import type { AttackOutcomeSources, ForcedCritKind } from '#types/attackOutcome.d.ts';
import type { OtherCreature } from '#types/otherCreature.d.ts';
import type { AttackOutcomeChange } from '../../models/rules/attackOutcome.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { actorRules } from '../actor/actorRules.js';
import localize from '../localize.js';
import type { AttackDelivery } from './attackDelivery.js';
import { incapacitatedCause, incapacitatedConditionOf } from './incapacitatedTarget.js';
import { DEFAULT_MISS_THRESHOLD } from './missThreshold.js';

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
	statuses?: ReadonlySet<string>;
}

/** One attack, as the Attack Outcome rules see it when it is rolled. */
interface AttackOutcomeInput {
	attacker: RuleOwner | null | undefined;
	/** The target, when the attack has exactly one. */
	target: (RuleOwner & Parameters<typeof incapacitatedConditionOf>[0]) | null | undefined;
	delivery: AttackDelivery | null;
	itemUuid: string | null | undefined;
	canCrit: boolean;
	canMiss: boolean;
	/** The damage types of the attack. */
	damageTypes?: readonly string[];
}

/** What a rule gave to a roll, so the charge can be read against the result. */
type AttackOutcomeGift =
	| 'cannotMiss'
	| 'critRange'
	| 'forcedCritAlways'
	| 'forcedCritOnHit'
	| 'anyDieCrits'
	| 'critD20'
	| 'vicious';

export interface AttackOutcomeCharge {
	identifier: string;
	gave: AttackOutcomeGift[];
}

/** The parts of an evaluated roll that tell if a rule changed its result. */
interface OutcomeRoll {
	isCritical?: boolean;
	primaryDieValue?: number;
	primaryDie?: { faces?: number };
	anyDieAtMax?: boolean;
	options?: { forceMiss?: boolean; missThreshold?: number };
}

/** The roll options the Attack Outcome rules give, and the charges their rules can spend. */
interface AttackOutcome {
	options: {
		canMiss: boolean;
		critRange?: number;
		forcedCrit?: ForcedCritKind;
		anyDieCrits?: boolean;
		critD20?: boolean;
		explosionStyle?: 'vicious';
		outcomeSources?: Partial<AttackOutcomeSources>;
		ignoreArmor?: boolean;
	};
	charges: AttackOutcomeCharge[];
}

function rulesOf(owner: RuleOwner | null | undefined): AttackOutcomeRuleLike[] {
	return actorRules<AttackOutcomeRuleLike>(owner).filter(
		(rule) => rule?.type === 'attackOutcome' && typeof rule.changeFor === 'function',
	);
}

/**
 * Reads the Attack Outcome rules of the one who attacks and of the target for
 * one attack. Any "cannot miss" wins, the largest crit range wins, and an
 * "always" Forced Crit beats one on a hit. A melee hit against a target in the
 * Incapacitated group is a crit (Core:419). A roll that cannot crit takes no
 * crit change, and one that cannot miss takes no "cannot miss". With Feature
 * Effects off, a rule or condition that gives a crit does not give it here.
 */
export function collectAttackOutcome(input: AttackOutcomeInput): AttackOutcome {
	const automatic = isRuleAutomationEnabled();
	const sources: AttackOutcomeSources = {
		cannotMiss: [],
		critRange: [],
		forcedCrit: [],
		anyDieCrits: [],
		critD20: [],
		vicious: [],
	};
	const charges: AttackOutcomeCharge[] = [];
	let critRange = 0;
	let forcedCrit: ForcedCritKind | null = null;
	let ignoreArmor = false;

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

			const gave: AttackOutcomeGift[] = [];
			if (change.cannotMiss && input.canMiss) {
				sources.cannotMiss.push(change.label);
				gave.push('cannotMiss');
			}
			if (input.canCrit && change.critRange > 0) {
				sources.critRange.push(change.label);
				critRange = Math.max(critRange, change.critRange);
				gave.push('critRange');
			}
			if (input.canCrit && automatic && change.forcedCrit) {
				sources.forcedCrit.push(change.label);
				if (forcedCrit !== 'always') forcedCrit = change.forcedCrit;
				gave.push(change.forcedCrit === 'always' ? 'forcedCritAlways' : 'forcedCritOnHit');
			}
			if (input.canCrit && automatic && change.anyDieCrits) {
				sources.anyDieCrits.push(change.label);
				gave.push('anyDieCrits');
			}
			if (input.canCrit && automatic && change.critD20) {
				sources.critD20?.push(change.label);
				gave.push('critD20');
			}
			if (input.canCrit && automatic && change.viciousCrits) {
				sources.vicious?.push(change.label);
				gave.push('vicious');
			}
			if (change.ignoreArmor) ignoreArmor = true;
			if (gave.length > 0 && change.chargePoolIdentifier) {
				charges.push({ identifier: change.chargePoolIdentifier, gave });
			}
		}
	}

	// The condition gives this itself: the creature has no item with a rule for it.
	if (input.attacker?.statuses?.has('swallowed')) {
		if (input.canMiss) sources.cannotMiss.push(localize('NIMBLE.conditions.swallowed'));
		ignoreArmor = true;
	}

	const condition =
		input.canCrit && automatic && input.delivery === 'melee'
			? incapacitatedConditionOf(input.target)
			: null;
	if (condition) {
		sources.forcedCrit.push(incapacitatedCause(condition));
		forcedCrit ??= 'onHit';
	}

	const options: AttackOutcome['options'] = {
		canMiss: input.canMiss && sources.cannotMiss.length === 0,
	};
	if (ignoreArmor) options.ignoreArmor = true;
	if (critRange > 0) options.critRange = critRange;
	if (forcedCrit) options.forcedCrit = forcedCrit;
	if (sources.anyDieCrits.length > 0) options.anyDieCrits = true;
	if (sources.critD20?.length) options.critD20 = true;
	if (sources.vicious?.length) options.explosionStyle = 'vicious';
	const named = Object.entries(sources).filter(([, labels]) => labels.length > 0);
	if (named.length > 0) options.outcomeSources = Object.fromEntries(named);
	return { options, charges };
}

function gaveToRoll(gift: AttackOutcomeGift, roll: OutcomeRoll): boolean {
	if (roll.options?.forceMiss) return false;
	const face = roll.primaryDieValue ?? 0;
	const faces = roll.primaryDie?.faces ?? 0;
	switch (gift) {
		case 'cannotMiss':
			return face > 0 && face <= (roll.options?.missThreshold ?? DEFAULT_MISS_THRESHOLD);
		case 'critRange':
		case 'forcedCritAlways':
		case 'forcedCritOnHit':
			return roll.isCritical === true && face < faces;
		case 'anyDieCrits':
			return roll.isCritical === true && face < faces && roll.anyDieAtMax === true;
		case 'critD20':
		case 'vicious':
			return roll.isCritical === true;
	}
}

/** The charges to spend, read from the roll: a rule that gave it nothing spends none. */
export function attackOutcomeChargesToSpend(
	charges: AttackOutcomeCharge[],
	roll: OutcomeRoll | null | undefined,
): string[] {
	if (!roll) return [];
	return charges
		.filter((charge) => charge.gave.some((gift) => gaveToRoll(gift, roll)))
		.map((charge) => charge.identifier);
}
