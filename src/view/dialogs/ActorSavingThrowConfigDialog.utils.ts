/** The lowest and highest roll mode an `adjust` rule can drive a save to. */
const ROLL_MODE_MIN = -3;
const ROLL_MODE_MAX = 3;

interface SavingThrowRollModeRuleData {
	type: string;
	disabled?: boolean;
	priority?: number;
	label?: string;
	target?: string;
	mode?: string;
	value?: number;
	selectedSave?: string | null;
	requiresChoice?: boolean;
	situation?: string;
}

interface RuleBearingItem {
	name?: string;
	rules?: { values(): Iterable<SavingThrowRollModeRuleData> };
}

interface ClassSavingThrowDefaults {
	advantage?: string | null;
	disadvantage?: string | null;
}

function collectRollModeRules(items: Iterable<RuleBearingItem>): SavingThrowRollModeRuleData[] {
	const rules: SavingThrowRollModeRuleData[] = [];

	for (const item of items) {
		if (!item.rules) continue;
		for (const rule of item.rules.values()) {
			if (rule.type === 'savingThrowRollMode') rules.push(rule);
		}
	}

	return rules.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));
}

/**
 * The saves a rule applies to. A specific save key wins, then the chosen save for a
 * choice-based rule, then the category targets. An unrecognised target applies to nothing.
 *
 * An absent `target` means `'all'`, matching the schema's `initial`. Every production caller
 * passes prepared rules, which always carry the field, so the fallback is defensive there — it
 * keeps this function's semantics identical to `resolveSavingThrowRollModes`, which does read
 * raw pack sources and needs it. The co-located tests exercise it directly.
 */
function resolveTargetSaves(
	rule: SavingThrowRollModeRuleData,
	currentRollModes: Record<string, number>,
	savingThrowKeys: string[],
): string[] {
	const { selectedSave } = rule;
	const target = rule.target ?? 'all';

	if (selectedSave && savingThrowKeys.includes(selectedSave)) return [selectedSave];
	if (savingThrowKeys.includes(target)) return [target];

	switch (target) {
		case 'all':
			return savingThrowKeys;
		case 'advantaged':
			return savingThrowKeys.filter((key) => currentRollModes[key] > 0);
		case 'disadvantaged':
			return savingThrowKeys.filter((key) => currentRollModes[key] < 0);
		case 'neutral':
			return savingThrowKeys.filter((key) => currentRollModes[key] === 0);
		default:
			return [];
	}
}

/**
 * The default roll mode every save would carry from the class defaults plus the actor's
 * `savingThrowRollMode` rules. This is what the "Reset to Class Defaults" button writes,
 * and what the button's visibility is decided against.
 *
 * Two kinds of rule are deliberately skipped: a choice-based rule with no save picked yet
 * has nothing to apply to, and a situational rule ("advantage against poison saves") only
 * applies when its circumstance comes up, which a single persisted value cannot express.
 * Situational rules surface through {@link collectSituationalRules} instead.
 */
export function calculateDefaultRollModes(
	items: Iterable<RuleBearingItem>,
	classSavingThrows: ClassSavingThrowDefaults,
	savingThrowKeys: string[],
): Record<string, number> {
	const rollModes = Object.fromEntries(savingThrowKeys.map((key) => [key, 0]));

	if (classSavingThrows.advantage) rollModes[classSavingThrows.advantage] = 1;
	if (classSavingThrows.disadvantage) rollModes[classSavingThrows.disadvantage] = -1;

	for (const rule of collectRollModeRules(items)) {
		if (rule.disabled) continue;
		if (rule.situation) continue;
		if (rule.requiresChoice && !rule.selectedSave) continue;

		const value = rule.value ?? 0;

		for (const saveKey of resolveTargetSaves(rule, rollModes, savingThrowKeys)) {
			// Branch on `adjust`, not `set`, so an absent mode falls to `set` — the schema's
			// `initial` — and this agrees with `resolveSavingThrowRollModes`, which branches
			// the same way on the raw pack sources it reads.
			if (rule.mode === 'adjust') {
				rollModes[saveKey] = Math.max(
					ROLL_MODE_MIN,
					Math.min(ROLL_MODE_MAX, rollModes[saveKey] + value),
				);
			} else {
				rollModes[saveKey] = value;
			}
		}
	}

	return rollModes;
}
