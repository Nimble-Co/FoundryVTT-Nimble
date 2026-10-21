export default function parseMonsterLevel(level: unknown): number | undefined {
	if (typeof level === 'number') return Number.isFinite(level) ? level : undefined;
	if (typeof level !== 'string') return undefined;

	const match = level.trim().match(/^(\d+)(?:\s*\/\s*(\d+))?$/);
	if (!match) return undefined;

	const numerator = Number(match[1]);
	const denominator = match[2] === undefined ? 1 : Number(match[2]);
	return denominator === 0 ? undefined : numerator / denominator;
}
