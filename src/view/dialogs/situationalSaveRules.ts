interface SituationalRuleData {
	type: string;
	disabled?: boolean;
	label?: string;
	value?: number;
	situation?: string;
}

interface RuleBearingItem {
	name?: string;
	rules?: { values(): Iterable<SituationalRuleData> };
}

export interface SituationalRollModeRule {
	/** The rule's own label, falling back to the item that carries it. */
	label: string;
	/** The circumstance the rule applies in, verbatim from the rule. */
	situation: string;
	/** Roll mode levels granted when that circumstance comes up — positive is advantage. */
	value: number;
}

/**
 * The actor's situational `savingThrowRollMode` rules — the ones that name a circumstance
 * ("advantage against poison saves") rather than moving a stored default roll mode.
 *
 * The saving throw config dialog lists them so a player can see what their character has,
 * and the save roll dialog offers each as a toggle that applies it to a single roll.
 * A zero-valued rule grants nothing and is dropped rather than shown as a no-op.
 */
export function collectSituationalRules(
	items: Iterable<RuleBearingItem>,
): SituationalRollModeRule[] {
	const situational: SituationalRollModeRule[] = [];

	for (const item of items) {
		if (!item.rules) continue;
		for (const rule of item.rules.values()) {
			if (rule.type !== 'savingThrowRollMode' || rule.disabled || !rule.situation) continue;
			if (!rule.value) continue;
			situational.push({
				label: rule.label || item.name || '',
				situation: rule.situation,
				value: rule.value,
			});
		}
	}

	return situational;
}
