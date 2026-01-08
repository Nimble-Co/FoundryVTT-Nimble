#!/usr/bin/env node
/**
 * Script to migrate attack sequence data in compendium JSON files.
 *
 * For each monster/legendary monster with an attackSequence field:
 * 1. Create an attackSequence item if one doesn't exist
 * 2. Set parentItemId on all action items to point to that attackSequence
 * 3. Clear the actor-level attackSequence field
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PACKS_DIR = path.join(process.cwd(), 'packs');

/**
 * Generate a Foundry-compatible 16-character random ID
 */
function generateId() {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

// Find all JSON files in a directory recursively
function findMonsterFiles(dir) {
	const files = [];

	function walkDir(currentPath) {
		const entries = fs.readdirSync(currentPath, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			if (entry.isDirectory()) {
				walkDir(fullPath);
			} else if (entry.isFile() && entry.name.endsWith('.json')) {
				files.push(fullPath);
			}
		}
	}

	walkDir(dir);
	return files;
}

function migrateFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	let data;

	try {
		data = JSON.parse(content);
	} catch (e) {
		console.error(`Failed to parse ${filePath}: ${e.message}`);
		return false;
	}

	// Check if this is an actor with items
	if (!data.items || !Array.isArray(data.items)) {
		return false;
	}

	// Check if actor has an attackSequence field with content
	const attackSequenceDescription = data.system?.attackSequence;
	const hasAttackSequenceField = 'attackSequence' in (data.system || {});

	// If no attackSequence field and no content, nothing to do
	if (!hasAttackSequenceField && !attackSequenceDescription) {
		return false;
	}

	// If field exists but is empty, just remove it
	if (!attackSequenceDescription || attackSequenceDescription.trim() === '') {
		if (hasAttackSequenceField) {
			delete data.system.attackSequence;
			fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n', 'utf8');
			console.log(`${path.basename(filePath)}: removed empty attackSequence field`);
			return true;
		}
		return false;
	}

	let modified = false;
	let attackSequenceId;

	// Find existing attackSequence item
	let attackSequenceItem = data.items.find(
		(item) => item.type === 'monsterFeature' && item.system?.subtype === 'attackSequence',
	);

	if (attackSequenceItem) {
		attackSequenceId = attackSequenceItem._id;
	} else {
		// Create new attackSequence item
		attackSequenceId = generateId();
		attackSequenceItem = {
			_id: attackSequenceId,
			name: 'Attack Sequence',
			type: 'monsterFeature',
			img: 'icons/svg/sword.svg',
			system: {
				macro: '',
				identifier: 'attack-sequence',
				rules: [],
				activation: {
					acquireTargetsFromTemplate: false,
					cost: {
						details: '',
						quantity: 1,
						type: 'none',
						isReaction: false,
					},
					duration: {
						details: '',
						quantity: 1,
						type: 'none',
					},
					effects: [],
					showDescription: true,
					targets: {
						count: 1,
						restrictions: '',
					},
					template: {
						length: 1,
						radius: 1,
						shape: '',
						width: 1,
					},
				},
				description: attackSequenceDescription,
				subtype: 'attackSequence',
				parentItemId: '',
			},
			effects: [],
			folder: null,
			sort: 0,
			flags: {},
		};

		// Insert attackSequence item at the beginning of items that will be in the Actions section
		// Find the first action item to insert before it
		const firstActionIndex = data.items.findIndex(
			(item) => item.type === 'monsterFeature' && item.system?.subtype === 'action',
		);

		if (firstActionIndex >= 0) {
			data.items.splice(firstActionIndex, 0, attackSequenceItem);
		} else {
			data.items.push(attackSequenceItem);
		}

		modified = true;
		console.log(`  Created attackSequence item with ID: ${attackSequenceId}`);
	}

	// Update all action items to reference the attackSequence
	let linkedCount = 0;
	for (const item of data.items) {
		if (item.type === 'monsterFeature' && item.system?.subtype === 'action') {
			if (item.system.parentItemId !== attackSequenceId) {
				item.system.parentItemId = attackSequenceId;
				linkedCount++;
				modified = true;
			}
		}
	}

	// Remove the actor-level attackSequence field entirely
	if ('attackSequence' in data.system) {
		delete data.system.attackSequence;
		modified = true;
	}

	if (modified) {
		// Write back with proper formatting
		fs.writeFileSync(filePath, JSON.stringify(data, null, '\t') + '\n', 'utf8');
		console.log(`${path.basename(filePath)}: linked ${linkedCount} actions to attackSequence`);
		return true;
	}

	return false;
}

// Main
const monstersDir = path.join(PACKS_DIR, 'monsters');
const legendaryMonstersDir = path.join(PACKS_DIR, 'legendaryMonsters');

const monsterFiles = fs.existsSync(monstersDir) ? findMonsterFiles(monstersDir) : [];
const legendaryFiles = fs.existsSync(legendaryMonstersDir)
	? findMonsterFiles(legendaryMonstersDir)
	: [];

const allFiles = [...monsterFiles, ...legendaryFiles];

console.log(`Found ${allFiles.length} monster files to process\n`);

let modifiedCount = 0;
for (const file of allFiles) {
	if (migrateFile(file)) {
		modifiedCount++;
	}
}

console.log(`\nMigration complete: ${modifiedCount} files modified`);
