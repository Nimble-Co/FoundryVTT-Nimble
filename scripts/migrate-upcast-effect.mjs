/**
 * Migration script: Move higherLevelEffect → upcastEffect for tier > 0 spells.
 *
 * For tier > 0 spells with non-empty higherLevelEffect:
 *   - Copy higherLevelEffect into upcastEffect
 *   - Clear higherLevelEffect
 *
 * For all spells: ensure upcastEffect field exists (empty string if not set).
 *
 * Usage: node scripts/migrate-upcast-effect.mjs
 */

import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Use glob from Node 22+ or fallback
let files;
try {
	files = globSync('packs/spells/core/**/*.json');
} catch {
	// Fallback: use a simple recursive approach
	const { readdirSync, statSync } = await import('node:fs');
	function walkDir(dir) {
		const results = [];
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				results.push(...walkDir(full));
			} else if (full.endsWith('.json')) {
				results.push(full);
			}
		}
		return results;
	}
	files = walkDir('packs/spells/core');
}

let migrated = 0;
let skipped = 0;
let total = 0;

for (const file of files) {
	total++;
	const raw = readFileSync(file, 'utf-8');
	const data = JSON.parse(raw);

	const system = data.system;
	if (!system?.description) {
		skipped++;
		continue;
	}

	const scalingMode = system.scaling?.mode ?? 'none';
	const higherLevelEffect = system.description.higherLevelEffect ?? '';
	const existingUpcast = system.description.upcastEffect ?? '';
	const hasUpcastScaling = scalingMode === 'upcast' || scalingMode === 'upcastChoice';

	if (hasUpcastScaling && higherLevelEffect && !existingUpcast) {
		// Move higherLevelEffect → upcastEffect only for spells with upcast scaling
		system.description.upcastEffect = higherLevelEffect;
		system.description.higherLevelEffect = '';
		migrated++;
	} else {
		// Ensure upcastEffect field exists
		if (!('upcastEffect' in system.description)) {
			system.description.upcastEffect = '';
		}
		skipped++;
	}

	// Write back with same formatting (tab indentation, trailing newline)
	const output = `${JSON.stringify(data, null, '\t')}\n`;
	writeFileSync(file, output, 'utf-8');
}

console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${total} total`);
