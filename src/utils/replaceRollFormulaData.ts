type RollConstructorWithReplace = typeof Roll & {
	replaceFormulaData?: (formula: string, data?: Record<string, unknown>) => string;
};

export default function replaceRollFormulaData(
	formula: unknown,
	rollData: Record<string, unknown> = {},
): string {
	const normalizedFormula =
		typeof formula === 'string' && formula.trim().length > 0 ? formula.trim() : '0';

	const replaceFormulaData = (Roll as RollConstructorWithReplace).replaceFormulaData;
	if (typeof replaceFormulaData === 'function') {
		try {
			return replaceFormulaData(normalizedFormula, rollData);
		} catch {
			// Fall back to simple @path replacement below.
		}
	}

	return normalizedFormula.replace(/@([\w.]+)/g, (_match, path: string) => {
		const value = foundry.utils.getProperty(rollData, path);
		return value == null ? '0' : String(value);
	});
}
