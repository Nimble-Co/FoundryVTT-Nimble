export default function calculateRollMode(
	defaultRollMode: number,
	rollModeModifier = 0,
	rollModeOverride: number | null = null,
): number {
	if (rollModeOverride) return rollModeOverride;

	return defaultRollMode + rollModeModifier;
}
