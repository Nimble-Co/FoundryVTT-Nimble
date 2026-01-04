#!/usr/bin/env node
/**
 * Migration script to add reach/range properties to monster features
 * based on their description text.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const MONSTERS_DIR = 'packs/monsters';

// Regex patterns to extract reach/range from descriptions
const REACH_PATTERN = /\(?\s*Reach\s+(\d+)\s*\)?/i;
const RANGE_PATTERN = /\(?\s*Range\s+(\d+)\s*\)?/i;

function getAllJsonFiles(dir, files = []) {
	const entries = readdirSync(dir);
	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			getAllJsonFiles(fullPath, files);
		} else if (entry.endsWith('.json')) {
			files.push(fullPath);
		}
	}
	return files;
}

function parseReachRange(description) {
	if (!description) return null;

	const reachMatch = description.match(REACH_PATTERN);
	const rangeMatch = description.match(RANGE_PATTERN);

	if (reachMatch) {
		return {
			selected: 'reach',
			value: parseInt(reachMatch[1], 10),
		};
	}

	if (rangeMatch) {
		return {
			selected: 'range',
			value: parseInt(rangeMatch[1], 10),
		};
	}

	return null;
}

function migrateMonsterFile(filePath) {
	const content = readFileSync(filePath, 'utf-8');
	const monster = JSON.parse(content);

	let modified = false;

	if (monster.items && Array.isArray(monster.items)) {
		for (const item of monster.items) {
			if (item.type !== 'monsterFeature') continue;

			const isAction = item.system?.subtype === 'action';

			// Only add properties to action subtypes
			if (!isAction) {
				// Remove properties if they were incorrectly added to non-actions
				if (item.system.properties) {
					delete item.system.properties;
					modified = true;
					console.log(`  ${item.name}: removed properties (not an action)`);
				}
				continue;
			}

			const description = item.system?.description || '';
			const parsed = parseReachRange(description);

			// Determine the selected type:
			// - If reach/range found in description, use that
			// - Otherwise default to melee
			let selected = 'melee';
			let distance = 1;

			if (parsed) {
				selected = parsed.selected;
				distance = parsed.value;
			}

			// Add or update properties field
			const needsUpdate =
				!item.system.properties ||
				item.system.properties.range !== undefined ||
				item.system.properties.reach !== undefined ||
				item.system.properties.selected === '';

			if (needsUpdate) {
				item.system.properties = { selected, distance };
				modified = true;
				console.log(`  ${item.name}: ${selected}${distance > 1 ? ' ' + distance : ''}`);
			}
		}
	}

	if (modified) {
		writeFileSync(filePath, JSON.stringify(monster, null, '\t') + '\n');
		return true;
	}

	return false;
}

function main() {
	console.log('Migrating monster reach/range properties...\n');

	const jsonFiles = getAllJsonFiles(MONSTERS_DIR);
	let modifiedCount = 0;

	for (const filePath of jsonFiles) {
		const relativePath = relative(process.cwd(), filePath);
		console.log(`Processing: ${relativePath}`);

		try {
			if (migrateMonsterFile(filePath)) {
				modifiedCount++;
			}
		} catch (error) {
			console.error(`  Error: ${error.message}`);
		}
	}

	console.log(`\nMigration complete. Modified ${modifiedCount} files.`);
}

main();
