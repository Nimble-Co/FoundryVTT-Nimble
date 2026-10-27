/** The lowest and highest roll mode an `adjust` rule can drive a save to. */
const ROLL_MODE_MIN = -3;
const ROLL_MODE_MAX = 3;

export interface SavingThrowRollModeRuleData {
	type: string;
	disabled?: boolean;
	priority?: number;
	label?: string;
	target?: string;
	mode?: string;
	value?: number;
	selectedSave?: string | null;
	requiresChoice?: boolean;
}

export interface ClassSavingThrowDefaults {
	advantage?: string | null;
	disadvantage?: string | null;
}

/**
 * The saves a rule applies to. A specific save key wins, then the chosen save for a
 * choice-based rule, then the category targets. An unrecognised target applies to nothing.
 *
 * An absent `target` means `'all'`, matching the schema's `initial`, because raw pack sources
 * reach here without the field.
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
 * The default roll mode every save carries from the class defaults plus a set of
 * `savingThrowRollMode` rules. Rules of any other type are ignored, so callers can hand over
 * everything an item or document source carries.
 *
 * Both the character creation dialog and the saving throw config's "Reset to Class Defaults"
 * button write what this returns, from rules read out of different shapes, so they must agree
 * on every rule down to the clamp and the `adjust` branch.
 *
 * A choice-based rule with no save picked is deliberately skipped: it has nothing to apply to.
 * Callers that hold the choice outside the rule stamp it onto `selectedSave` first.
 */
export default function calculateSavingThrowRollModes(
	rules: Iterable<SavingThrowRollModeRuleData>,
	classSavingThrows: ClassSavingThrowDefaults,
	savingThrowKeys: string[],
): Record<string, number> {
	const rollModes = Object.fromEntries(savingThrowKeys.map((key) => [key, 0]));

	if (classSavingThrows.advantage) rollModes[classSavingThrows.advantage] = 1;
	if (classSavingThrows.disadvantage) rollModes[classSavingThrows.disadvantage] = -1;

	const applicableRules = [...rules]
		.filter((rule) => rule.type === 'savingThrowRollMode' && !rule.disabled)
		.sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));

	for (const rule of applicableRules) {
		if (rule.requiresChoice && !rule.selectedSave) continue;

		const value = rule.value ?? 0;

		for (const saveKey of resolveTargetSaves(rule, rollModes, savingThrowKeys)) {
			// Branch on `adjust`, not `set`, so an absent mode falls to `set`, which is the
			// schema's `initial`.
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
