/**
 * Evaluates a roll formula by substituting actor data and simplifying numeric parts.
 * Preserves dice notation (e.g., "1d6") while evaluating static math expressions.
 *
 * @param formula - The roll formula to evaluate (e.g., "1d6 + @abilities.strength.mod")
 * @param actor - The actor to get roll data from
 * @returns The simplified formula string
 */
export function evaluateFormula(
	formula: string | undefined,
	actor: { getRollData: () => Record<string, unknown> },
): string {
	if (!formula) return '';

	try {
		const rollData = actor.getRollData();
		const substituted = Roll.replaceFormulaData(formula, rollData, { missing: '0' });

		const parts = substituted.split(/([+-])/);
		const simplified: string[] = [];

		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;

			if (trimmed === '+' || trimmed === '-') {
				simplified.push(trimmed);
			} else if (/^\d*d\d+/i.test(trimmed)) {
				// Keep dice notation as-is
				simplified.push(trimmed);
			} else {
				try {
					const evaluated = Roll.safeEval(trimmed);
					if (typeof evaluated === 'number' && !Number.isNaN(evaluated)) {
						simplified.push(String(Math.floor(evaluated)));
					} else {
						simplified.push(trimmed);
					}
				} catch {
					simplified.push(trimmed);
				}
			}
		}

		let result = simplified.join(' ').replace(/\s+/g, ' ').trim();
		// Remove "+ 0" or "- 0" terms
		result = result.replace(/[+-]\s*0(?!\d)/g, '').trim();
		// Clean up leading operators and double operators
		result = result
			.replace(/^\s*[+-]\s*/, '')
			.replace(/[+-]\s*[+-]/g, '+')
			.trim();

		return result || formula;
	} catch {
		return formula;
	}
}
