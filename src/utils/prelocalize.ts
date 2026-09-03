import localize from './localize.js';

// Strings with `{placeholder}` tokens must stay as localization keys: they are
// consumed via `game.i18n.format(key, data)`, and V14's format only
// interpolates when it receives a real translation key (it returns an already-
// localized string verbatim, leaving the raw `{placeholder}` visible).
const PLACEHOLDER_PATTERN = /\{[^}]+\}/;

export function prelocalize(input: unknown): unknown {
	if (typeof input === 'string') {
		const localized = localize(input);
		// Keep the key so `format(key, data)` can interpolate the placeholders.
		return PLACEHOLDER_PATTERN.test(localized) ? input : localized;
	}

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
