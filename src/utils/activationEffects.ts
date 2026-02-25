interface ActivationEffectNode extends Record<string, unknown> {
	children?: unknown;
	type?: unknown;
	formula?: unknown;
	roll?: unknown;
}

const DEFAULT_SUPPORTED_ACTIVATION_EFFECT_TYPES = ['damage', 'text'] as const;

export function flattenActivationEffects(effects: unknown): ActivationEffectNode[] {
	const flattened: ActivationEffectNode[] = [];

	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;

		const asRecord = node as ActivationEffectNode;
		flattened.push(asRecord);

		if (!Array.isArray(asRecord.children)) return;
		for (const child of asRecord.children) {
			walk(child);
		}
	};

	if (Array.isArray(effects)) {
		for (const effect of effects) walk(effect);
	}

	return flattened;
}

export function getUnsupportedActivationEffectTypes(
	effects: unknown,
	supportedTypes: readonly string[] = DEFAULT_SUPPORTED_ACTIVATION_EFFECT_TYPES,
): string[] {
	const flattened = flattenActivationEffects(effects);
	if (flattened.length === 0) return [];

	const supportedSet = new Set(supportedTypes);
	const unsupportedTypes = new Set<string>();

	for (const node of flattened) {
		const nodeType = node.type;
		if (typeof nodeType !== 'string' || nodeType.length === 0) continue;
		if (supportedSet.has(nodeType)) continue;
		unsupportedTypes.add(nodeType);
	}

	return [...unsupportedTypes].sort((left, right) => left.localeCompare(right));
}

export function getPrimaryDamageFormulaFromActivationEffects(effects: unknown): string | null {
	const flattened = flattenActivationEffects(effects);

	for (const node of flattened) {
		if (node.type !== 'damage') continue;

		const directFormula = node.formula;
		if (typeof directFormula === 'string' && directFormula.trim().length > 0) {
			return directFormula.trim();
		}

		const directRoll = node.roll;
		if (typeof directRoll === 'string' && directRoll.trim().length > 0) {
			return directRoll.trim();
		}
	}

	return null;
}
