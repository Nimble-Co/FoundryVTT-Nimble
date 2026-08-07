import localize from '#utils/localize.ts';

/**
 * The compact label for a roll mode level — "Adv ×2", "Dis ×1", "Normal".
 *
 * A level is a number of extra d20s, not a numeric bonus: `1` rolls `2d20khn` (one extra die,
 * keep the highest). `RollModeConfig` renders the same values in longer prose for its slider,
 * so it deliberately keeps its own formatter.
 */
export default function formatRollModeLabel(value: number): string {
	if (value > 0) {
		return localize('NIMBLE.saveConfig.rollModeAdvantage', { count: String(value) });
	}

	if (value < 0) {
		return localize('NIMBLE.saveConfig.rollModeDisadvantage', { count: String(Math.abs(value)) });
	}

	return localize('NIMBLE.saveConfig.rollModeNormal');
}
