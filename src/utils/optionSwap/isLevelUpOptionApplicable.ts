/**
 * Whether a feature's level-up option applies at the given level.
 *
 * An option with an empty `applyAtLevels` list applies at every level; otherwise it
 * applies only at the listed levels.
 */
export default function isLevelUpOptionApplicable(
	option: { applyAtLevels: number[] },
	level: number,
): boolean {
	return option.applyAtLevels.length === 0 || option.applyAtLevels.includes(level);
}
