export default function generateBlankSkillSet() {
	const { skills } = CONFIG.NIMBLE;

	return Object.keys(skills).reduce(
		(acc, skillKey) => {
			acc[skillKey] = null;
			return acc;
		},
		{} as Record<string, null>,
	);
}
