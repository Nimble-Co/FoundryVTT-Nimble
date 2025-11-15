import localize from './localize';

export function prelocalize(input: unknown): unknown {
	if (typeof input === 'string') return localize(input);

	if (Array.isArray(input)) return input.map(prelocalize);

	if (input instanceof Map) {
		const localizedMap = new Map();

		for (const [key, value] of input.entries()) {
			localizedMap.set(key, prelocalize(value));
		}

		return localizedMap;
	}

	if (input && typeof input === 'object') {
		// Ignore instances of classes
		if (input.constructor && input.constructor !== Object) return input;

		// Recursively process each key-value pair in the object
		const localizedObject: Record<string, any> = {};

		for (const [key, value] of Object.entries(input)) {
			localizedObject[key] = prelocalize(value);
		}

		return localizedObject;
	}

	// Return the value as-is if it's neither a string, array, nor object
	return input;
}
