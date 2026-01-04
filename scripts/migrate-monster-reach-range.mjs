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

			// Determine the attack type:
			// - If reach/range found in description, use that
			// - Otherwise default to melee
			let attackType = 'melee';
			let distance = 1;

			if (parsed) {
				attackType = parsed.selected;
				distance = parsed.value;
			}

			// Ensure activation.targets exists
			if (!item.system.activation) {
				item.system.activation = {};
			}
			if (!item.system.activation.targets) {
				item.system.activation.targets = {};
			}

			// Add or update attackType and distance in activation.targets
			const targets = item.system.activation.targets;
			const needsUpdate = targets.attackType !== attackType || targets.distance !== distance;

			if (needsUpdate) {
				targets.attackType = attackType;
				targets.distance = distance;
				modified = true;
				console.log(`  ${item.name}: ${attackType}${distance > 1 ? ' ' + distance : ''}`);
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
