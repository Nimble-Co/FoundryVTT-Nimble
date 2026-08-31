import calculateSavingThrowRollModes, {
	type ClassSavingThrowDefaults,
	type SavingThrowRollModeRuleData,
} from '#utils/calculateSavingThrowRollModes.js';

interface RuleBearingItem {
	name?: string;
	rules: { values(): Iterable<SavingThrowRollModeRuleData> };
}

/**
 * The default roll mode every save would carry from the class defaults plus the actor's
 * `savingThrowRollMode` rules. This is what the "Reset to Class Defaults" button writes,
 * and what the button's visibility is decided against.
 *
 * `situationalRollMode` rules never reach the calculation: they are a separate rule type,
 * offered per roll in the check roll dialog rather than stored on the actor.
 */
export function calculateDefaultRollModes(
	items: Iterable<RuleBearingItem>,
	classSavingThrows: ClassSavingThrowDefaults,
	savingThrowKeys: string[],
): Record<string, number> {
	const rules = [...items].flatMap((item) => [...item.rules.values()]);

	return calculateSavingThrowRollModes(rules, classSavingThrows, savingThrowKeys);
}
