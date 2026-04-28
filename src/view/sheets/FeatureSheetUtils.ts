import { LEVEL_MAX, LEVEL_MIN, MIN_SELECTION_COUNT } from './FeatureSheetConstants.js';

export function parseLevels(rawLevels: unknown): number[] {
	if (typeof rawLevels !== 'string') return [];

	const levelValues = rawLevels
		.split(',')
		.map((value) => Number.parseInt(value.trim(), 10))
		.filter((value) => Number.isInteger(value) && value >= LEVEL_MIN && value <= LEVEL_MAX);

	return [...new Set(levelValues)].sort((a, b) => a - b);
}

export function parseSelectionCountByLevel(raw: unknown): Record<string, number> {
	if (typeof raw !== 'string') return {};

	const entries: Record<string, number> = {};
	for (const part of raw.split(',')) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		const [levelPart, countPart] = trimmed.split(':').map((value) => value?.trim());
		const level = Number.parseInt(levelPart, 10);
		const count = Number.parseInt(countPart, 10);

		if (!Number.isInteger(level) || level < LEVEL_MIN || level > LEVEL_MAX) continue;
		if (!Number.isInteger(count) || count < MIN_SELECTION_COUNT) continue;

		entries[String(level)] = count;
	}

	return entries;
}

export function getGainedAtLevelsDisplayValue(
	gainedAtLevels: number[],
	gainedAtLevel: number | null | undefined,
): string {
	if (gainedAtLevels.length > 0) return gainedAtLevels.join(', ');
	return Number.isInteger(gainedAtLevel) ? String(gainedAtLevel) : '';
}

export function getSelectionCountByLevelDisplayValue(
	selectionCountByLevel: Record<string, number>,
): string {
	return Object.entries(selectionCountByLevel)
		.map(([level, count]): [number, number] => [Number.parseInt(level, 10), count])
		.filter(([level]) => Number.isInteger(level))
		.sort(([a], [b]) => a - b)
		.map(([level, count]) => `${level}: ${count}`)
		.join(', ');
}
