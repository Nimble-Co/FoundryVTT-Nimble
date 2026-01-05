#!/usr/bin/env node
/**
 * Migration script to add reach/range properties to monster features
 * based on their description text.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const MONSTERS_DIRS = ['packs/monsters', 'packs/legendaryMonsters'];

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

			// Remove old properties field if it exists (migrating to new location)
			if (item.system.properties) {
				delete item.system.properties;
				modified = true;
			}

			// Only add attackType/distance to action subtypes
			if (!isAction) {
				// Ensure activation.targets exists but without attackType for non-actions
				if (item.system.activation?.targets?.attackType) {
					delete item.system.activation.targets.attackType;
					delete item.system.activation.targets.distance;
					modified = true;
					console.log(`  ${item.name}: removed attackType (not an action)`);
				}
				continue;
			}

			const description = item.system?.description || '';
			const parsed = parseReachRange(description);

			// Ensure activation.targets exists
			if (!item.system.activation) {
				item.system.activation = {};
			}
			if (!item.system.activation.targets) {
				item.system.activation.targets = {};
			}

			const targets = item.system.activation.targets;

			// Only add attackType/distance if reach or range is found in description
			if (parsed) {
				const needsUpdate =
					targets.attackType !== parsed.selected || targets.distance !== parsed.value;

				if (needsUpdate) {
					targets.attackType = parsed.selected;
					targets.distance = parsed.value;
					modified = true;
					console.log(`  ${item.name}: ${parsed.selected} ${parsed.value}`);
				}
			} else {
				// Remove attackType if it was incorrectly set (e.g., to 'melee')
				if (targets.attackType) {
					targets.attackType = '';
					targets.distance = 1;
					modified = true;
					console.log(`  ${item.name}: removed attackType (no reach/range in description)`);
				}
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

	let modifiedCount = 0;

	for (const dir of MONSTERS_DIRS) {
		const jsonFiles = getAllJsonFiles(dir);

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
	}

	console.log(`\nMigration complete. Modified ${modifiedCount} files.`);
}

main();
