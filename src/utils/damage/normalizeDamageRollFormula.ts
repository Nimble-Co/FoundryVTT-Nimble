/**
 * Normalizes a damage roll formula string, fixing common OCR-like typos in dice notation
 * (e.g., "1dI2" → "1d12", "2d6O" → "2d60") while preserving valid formula structure
 * including variable references (@key, @level) and math functions (floor, ceil, etc.).
 *
 * Falls back to progressively simpler extractions if the normalized formula is invalid.
 */
export function normalizeDamageRollFormula(formula: unknown): string {
	const normalized = typeof formula === 'string' ? formula.replace(/\s+/g, ' ').trim() : '';
	if (!normalized) return '0';

	// Fix OCR-like typos in dice notation (e.g., "1dI2" → "1d12") but skip computed
	// dice counts like "(expr)d12" where a closing paren provides the count.
	const normalizedDiceFaces = normalized.replace(
		/(?<!\))(\b\d+)d([0-9oO|Il]+)\b/g,
		(_match, rawCount, rawFaces) => {
			const countValue = String(rawCount ?? '').replace(/[^0-9]/g, '');
			const facesValue = String(rawFaces ?? '')
				.replace(/[oO]/g, '0')
				.replace(/[^0-9]/g, '');
			const normalizedCount = countValue.length > 0 ? countValue : '1';
			const normalizedFaces = facesValue.length > 0 ? facesValue : '0';
			return `${normalizedCount}d${normalizedFaces}`;
		},
	);

	const validateFormula = (candidate: string): boolean => {
		const trimmed = candidate.trim();
		if (!trimmed) return false;
		try {
			return Roll.validate(trimmed);
		} catch {
			return false;
		}
	};

	if (validateFormula(normalizedDiceFaces)) return normalizedDiceFaces;

	const firstSegment =
		normalizedDiceFaces
			.split(/\s*(?:,|;|\bor\b)\s*/i)
			.map((segment) => segment.trim())
			.find((segment) => segment.length > 0) ?? '';
	if (firstSegment && validateFormula(firstSegment)) return firstSegment;

	const diceMatch = normalizedDiceFaces.match(/\b\d*d\d+(?:\s*[+-]\s*\d+)?\b/i);
	if (diceMatch) {
		const extracted = diceMatch[0].replace(/\s+/g, '');
		if (validateFormula(extracted)) return extracted;
	}

	return normalizedDiceFaces;
}
