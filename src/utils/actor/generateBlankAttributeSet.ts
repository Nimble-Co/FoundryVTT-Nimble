export default function generateBlankAttributeSet() {
	const { abilityScores } = CONFIG.NIMBLE;

	return Object.keys(abilityScores).reduce(
		(acc, abilityKey) => {
			acc[abilityKey] = null;
			return acc;
		},
		{} as Record<string, null>,
	);
}
