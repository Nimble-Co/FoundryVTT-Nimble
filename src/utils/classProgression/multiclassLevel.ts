export const MAX_CHARACTER_LEVEL = 20;

export function characterLevel(classLevels: readonly number[]): number {
	return classLevels.reduce((sum, level) => sum + level, 0);
}

/**
 * Whether level up is closed.
 * With multiclassing off, the first class's own level is the cap, matching a single-class hero.
 * With it on, the cap is the sum of class levels. No class means there is nothing to level.
 */
export function levelUpAtCap(classLevels: readonly number[], multiclass: boolean): boolean {
	if (classLevels.length === 0) return true;
	if (!multiclass) return classLevels[0] >= MAX_CHARACTER_LEVEL;
	return characterLevel(classLevels) >= MAX_CHARACTER_LEVEL;
}

/**
 * The one class whose level is strictly above the others.
 * A tie has no single highest class, so the caller leaves saves as they are.
 */
export function uniqueHighestClassIdentifier(
	classes: readonly { identifier: string; level: number }[],
): string | null {
	let highest = -1;
	let winner: string | null = null;
	let tied = false;

	for (const entry of classes) {
		if (entry.level > highest) {
			highest = entry.level;
			winner = entry.identifier;
			tied = false;
		} else if (entry.level === highest) {
			tied = true;
		}
	}

	return tied ? null : winner;
}

/**
 * A class on a character counts its starting hit points only when it is the starting class.
 * A class that is not on a character, or a character with no starting class yet, keeps them.
 */
export function countsAsStartingClass(options: {
	embedded: boolean;
	startingClassIdentifier: string | null | undefined;
	classIdentifier: string;
}): boolean {
	if (!options.embedded) return true;
	if (!options.startingClassIdentifier) return true;
	return options.startingClassIdentifier === options.classIdentifier;
}

/** Maximum hit points for one class: starting hit points, when they count, plus each level's roll. */
export function classMaximumHp(options: {
	countsStartingHp: boolean;
	startingHp: number;
	hpData: readonly number[];
}): number {
	const rolled = options.hpData.reduce((sum, value) => sum + value, 0);
	return (options.countsStartingHp ? options.startingHp : 0) + rolled;
}
