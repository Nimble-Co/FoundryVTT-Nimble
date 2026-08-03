/**
 * Maps a spell school to the damage type its spells deal. Used when retagging a
 * "keep and convert" exception spell so its elemental damage matches the new
 * school. Note the mapping is not identity: the Ice school deals `cold` damage.
 */
export const SCHOOL_TO_DAMAGE_TYPE: Record<string, string> = {
	fire: 'fire',
	ice: 'cold',
	lightning: 'lightning',
};

/** The elemental damage types that a conversion may rewrite. */
const ELEMENTAL_DAMAGE_TYPES = new Set(Object.values(SCHOOL_TO_DAMAGE_TYPE));

/** Resolves the damage type for a school, or null when the school is non-elemental. */
export function schoolToDamageType(school: string): string | null {
	return SCHOOL_TO_DAMAGE_TYPE[school] ?? null;
}

/**
 * Deep-clones a spell's `activation.effects` array, remapping any elemental
 * damage type (fire/cold/lightning) to `toDamageType`. Non-elemental damage
 * (radiant, necrotic, physical, …) is left untouched. Recurses into the nested
 * `on.<outcome>` effect arrays produced by saving-throw and attack effects.
 */
export function retagEffectsDamageType(effects: unknown, toDamageType: string): unknown[] {
	if (!Array.isArray(effects)) return [];

	const remapNode = (node: unknown): unknown => {
		if (!node || typeof node !== 'object') return node;
		const clone: Record<string, unknown> = { ...(node as Record<string, unknown>) };

		if (
			typeof clone.damageType === 'string' &&
			ELEMENTAL_DAMAGE_TYPES.has(clone.damageType as string)
		) {
			clone.damageType = toDamageType;
		}

		if (clone.on && typeof clone.on === 'object') {
			const on = clone.on as Record<string, unknown>;
			const newOn: Record<string, unknown> = { ...on };
			for (const [outcome, children] of Object.entries(on)) {
				if (Array.isArray(children)) {
					newOn[outcome] = children.map(remapNode);
				}
			}
			clone.on = newOn;
		}

		return clone;
	};

	return effects.map(remapNode);
}
