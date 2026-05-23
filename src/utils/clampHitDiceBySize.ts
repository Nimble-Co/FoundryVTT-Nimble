type HitDiceBySize =
	| Record<number, { current: number; total: number }>
	| Record<string, { current: number; total: number }>;

function clampHitDiceBySize<T extends HitDiceBySize>(hitDiceBySize: T): T {
	for (const data of Object.values(hitDiceBySize)) {
		data.total = Math.max(data.total, 0);
		data.current = Math.min(Math.max(data.current, 0), data.total);
	}

	return hitDiceBySize;
}

export { clampHitDiceBySize };
