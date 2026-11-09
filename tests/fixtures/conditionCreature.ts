/** A creature that has the given conditions, as its self and target tags. */
export function taggedCreature(
	name: string,
	conditions: string[] = [],
	extra: Record<string, unknown> = {},
) {
	return {
		name,
		uuid: `Actor.${name}`,
		getDomain: () => new Set(conditions.map((condition) => `self:${condition}`)),
		getTargetDomain: () => new Set(conditions.map((condition) => `target:${condition}`)),
		...extra,
	};
}
