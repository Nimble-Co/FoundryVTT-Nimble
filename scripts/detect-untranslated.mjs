#!/usr/bin/env node
/**
 * Script to detect untranslated keys in language files
 * Compares each language file to en.json and reports keys with identical values
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getAllKeys, LANG_DIR, SOURCE_LANG } from './lib/i18n-utils.mjs';

/**
 * Find keys in target that have identical values to source (untranslated)
 * @param {object} source - The source (English) translations
 * @param {object} target - The target language translations
 * @returns {string[]} - List of untranslated keys
 */
function findUntranslatedKeys(source, target) {
	const sourceKeys = getAllKeys(source);
	const targetKeys = getAllKeys(target);
	const untranslated = [];

	for (const [key, sourceValue] of sourceKeys) {
		const targetValue = targetKeys.get(key);

		// If the target has this key and the value is identical to English, it's untranslated
		if (targetValue !== undefined && targetValue === sourceValue) {
			untranslated.push(key);
		}
	}

	return untranslated;
}

/**
 * Print a list of keys with truncation for large lists
 * @param {string[]} keys - Keys to print
 * @param {string} prefix - Prefix for each line
 * @param {number} showCount - Number of keys to show before truncating
 */
function printKeys(keys, prefix, showCount = 10) {
	if (keys.length <= showCount) {
		for (const key of keys) {
			console.log(`${prefix}${key}`);
		}
	} else {
		for (const key of keys.slice(0, showCount)) {
			console.log(`${prefix}${key}`);
		}
		console.log(`${prefix.slice(0, -2)}... and ${keys.length - showCount} more`);
	}
}

function main() {
	console.log('Detecting untranslated keys in language files...\n');

	// Read source language file
	const sourcePath = join(LANG_DIR, SOURCE_LANG);
	let source;

	try {
		source = JSON.parse(readFileSync(sourcePath, 'utf-8'));
	} catch (error) {
		console.error(`Error reading source file ${sourcePath}: ${error.message}`);
		process.exit(1);
	}

	const sourceKeyCount = getAllKeys(source).size;
	console.log(`Source (en.json): ${sourceKeyCount} keys\n`);

	// Get all language files
	const files = readdirSync(LANG_DIR).filter(
		(f) => f.endsWith('.json') && f !== SOURCE_LANG
	);

	if (files.length === 0) {
		console.log('No other language files found to check.');
		return;
	}

	let hasUntranslated = false;
	let hasErrors = false;

	for (const file of files) {
		const filePath = join(LANG_DIR, file);

		console.log(`Checking: ${file}`);

		try {
			const target = JSON.parse(readFileSync(filePath, 'utf-8'));
			const targetKeyCount = getAllKeys(target).size;
			const untranslated = findUntranslatedKeys(source, target);

			if (untranslated.length > 0) {
				hasUntranslated = true;
				const translatedCount = targetKeyCount - untranslated.length;
				const percentage = ((translatedCount / sourceKeyCount) * 100).toFixed(1);

				console.log(`  ${untranslated.length} untranslated keys (${percentage}% translated)`);
				printKeys(untranslated, '    - ');
			} else {
				console.log('  Fully translated!');
			}
		} catch (error) {
			console.error(`  Error: ${error.message}`);
			hasErrors = true;
		}

		console.log('');
	}

	if (hasErrors || hasUntranslated) {
		process.exit(1);
	}
}

main();
