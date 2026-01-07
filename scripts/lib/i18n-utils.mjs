/**
 * Shared utilities for i18n scripts
 */

/**
 * Recursively get all keys from a nested object
 * @param {object} obj - The object to extract keys from
 * @param {string} prefix - The current key prefix
 * @returns {Map<string, any>} - Map of dot-notation keys to values
 */
export function getAllKeys(obj, prefix = '') {
	const keys = new Map();

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			const nested = getAllKeys(value, fullKey);
			for (const [nestedKey, nestedValue] of nested) {
				keys.set(nestedKey, nestedValue);
			}
		} else {
			keys.set(fullKey, value);
		}
	}

	return keys;
}

/**
 * Set a value in a nested object using dot notation
 * @param {object} obj - The object to modify
 * @param {string} path - Dot-notation path
 * @param {any} value - The value to set
 */
export function setNestedValue(obj, path, value) {
	const keys = path.split('.');
	let current = obj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (!(key in current) || typeof current[key] !== 'object') {
			current[key] = {};
		}
		current = current[key];
	}

	current[keys[keys.length - 1]] = value;
}

/**
 * Get a value from a nested object using dot notation
 * @param {object} obj - The object to read from
 * @param {string} path - Dot-notation path
 * @returns {any} - The value or undefined
 */
export function getNestedValue(obj, path) {
	const keys = path.split('.');
	let current = obj;

	for (const key of keys) {
		if (current === undefined || current === null || typeof current !== 'object') {
			return undefined;
		}
		current = current[key];
	}

	return current;
}

/**
 * Recursively sort object keys alphabetically
 * @param {object} obj - The object to sort
 * @returns {object} - New object with sorted keys
 */
export function sortObjectKeys(obj) {
	if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
		return obj;
	}

	const sorted = {};
	const keys = Object.keys(obj).sort();

	for (const key of keys) {
		sorted[key] = sortObjectKeys(obj[key]);
	}

	return sorted;
}

/** Directory containing language files */
export const LANG_DIR = 'public/lang';

/** Source language file name */
export const SOURCE_LANG = 'en.json';
