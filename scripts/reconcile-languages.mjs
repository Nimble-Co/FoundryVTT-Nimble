#!/usr/bin/env node
/**
 * Script to reconcile language files with en.json
 * Adds missing keys from en.json to other language files using English values as placeholders
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import {
	getAllKeys,
	getNestedValue,
	setNestedValue,
	sortObjectKeys,
	LANG_DIR,
	SOURCE_LANG,
} from './lib/i18n-utils.mjs';

/**
 * Reconcile a target language file with the source (en.json)
 * @param {object} source - The source (English) translations
 * @param {object} target - The target language translations
 * @returns {{ result: object, added: string[] }} - Reconciled object and list of added keys
 */
function reconcile(source, target) {
	const sourceKeys = getAllKeys(source);
	const added = [];
	const result = JSON.parse(JSON.stringify(target)); // Deep clone

	for (const [key, value] of sourceKeys) {
		const existingValue = getNestedValue(result, key);

		if (existingValue === undefined) {
			setNestedValue(result, key, value);
			added.push(key);
		}
	}

	return { result: sortObjectKeys(result), added };
}

/**
 * Find keys in target that don't exist in source (orphaned keys)
 * @param {object} source - The source (English) translations
 * @param {object} target - The target language translations
 * @returns {string[]} - List of orphaned keys
 */
function findOrphanedKeys(source, target) {
	const sourceKeys = getAllKeys(source);
	const targetKeys = getAllKeys(target);
	const orphaned = [];

	for (const key of targetKeys.keys()) {
		if (!sourceKeys.has(key)) {
			orphaned.push(key);
		}
	}

	return orphaned;
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
	console.log('Reconciling language files with en.json...\n');

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
		console.log('No other language files found to reconcile.');
		console.log('To add a new language, create a file like "es.json" or "de.json" in public/lang/');
		return;
	}

	let totalAdded = 0;
	let hasErrors = false;

	for (const file of files) {
		const filePath = join(LANG_DIR, file);
		const langCode = basename(file, '.json');

		console.log(`Processing: ${file}`);

		try {
			const target = JSON.parse(readFileSync(filePath, 'utf-8'));
			const { result, added } = reconcile(source, target);
			const orphaned = findOrphanedKeys(source, target);

			if (added.length > 0) {
				writeFileSync(filePath, JSON.stringify(result, null, '\t') + '\n');
				console.log(`  Added ${added.length} missing keys`);
				printKeys(added, '    + ');
				totalAdded += added.length;
			} else {
				console.log('  Already up to date');
			}

			if (orphaned.length > 0) {
				console.log(`  Warning: ${orphaned.length} orphaned keys (exist in ${langCode} but not in en)`);
				printKeys(orphaned, '    ? ', 5);
			}
		} catch (error) {
			console.error(`  Error: ${error.message}`);
			hasErrors = true;
		}

		console.log('');
	}

	console.log(`Reconciliation complete. Added ${totalAdded} total keys across all files.`);

	if (hasErrors) {
		process.exit(1);
	}
}

main();
