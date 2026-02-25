/**
 * Fuzzy-match 5e spell names against the Nimble spell compendium.
 * Uses Levenshtein distance for fuzzy matching.
 */

import type { Dnd5eSpellcasting, SpellMatchResult } from './types.js';

// ─── Levenshtein Distance ────────────────────────────────────────────────────

/**
 * Compute the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
	const m = a.length;
	const n = b.length;

	// Use a single flat array instead of 2D matrix for performance
	const prev = new Array<number>(n + 1);
	const curr = new Array<number>(n + 1);

	for (let j = 0; j <= n; j++) prev[j] = j;

	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				curr[j] = prev[j - 1];
			} else {
				curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
			}
		}
		for (let j = 0; j <= n; j++) prev[j] = curr[j];
	}

	return prev[n];
}

// ─── Name Normalization ──────────────────────────────────────────────────────

/**
 * Normalize a spell name for matching: lowercase, strip hyphens/spaces/apostrophes/punctuation.
 */
export function normalizeSpellName(name: string): string {
	return name
		.toLowerCase()
		.replace(/['\u2019\u2018]/g, '') // apostrophes and smart quotes
		.replace(/[-–—]/g, ' ') // hyphens and dashes → spaces
		.replace(/[^a-z0-9\s]/g, '') // remove remaining punctuation
		.replace(/\s+/g, ' ')
		.trim();
}

// ─── Spell Matching ──────────────────────────────────────────────────────────

interface NimbleSpellIndexEntry {
	name: string;
	uuid: string;
}

/**
 * Match a single 5e spell name against the Nimble spell index.
 * Returns the best match with confidence level.
 */
export function matchSpell(
	spellName: string,
	nimbleSpells: NimbleSpellIndexEntry[],
): SpellMatchResult {
	const normalized = normalizeSpellName(spellName);

	if (!normalized || nimbleSpells.length === 0) {
		return { spellName, flag: 'skipped' };
	}

	let bestMatch: NimbleSpellIndexEntry | undefined;
	let bestDistance = Infinity;

	for (const nimbleSpell of nimbleSpells) {
		const nimbleNormalized = normalizeSpellName(nimbleSpell.name);
		const distance = levenshteinDistance(normalized, nimbleNormalized);

		if (distance < bestDistance) {
			bestDistance = distance;
			bestMatch = nimbleSpell;
		}

		// Early exit on exact match
		if (distance === 0) break;
	}

	if (!bestMatch) {
		return { spellName, flag: 'skipped' };
	}

	// Exact match (distance 0)
	if (bestDistance === 0) {
		return {
			spellName,
			flag: 'auto',
			matchedNimbleName: bestMatch.name,
			matchedItemUuid: bestMatch.uuid,
			distance: 0,
		};
	}

	// Close match: distance ≤ 3 AND ≤ 30% of name length
	const maxAllowedDistance = Math.max(3, Math.ceil(normalized.length * 0.3));
	if (bestDistance <= 3 && bestDistance <= maxAllowedDistance) {
		return {
			spellName,
			flag: 'review',
			matchedNimbleName: bestMatch.name,
			matchedItemUuid: bestMatch.uuid,
			distance: bestDistance,
		};
	}

	// No good match
	return { spellName, flag: 'skipped', distance: bestDistance };
}

/**
 * Match all spells from a 5e spellcasting block against the Nimble spell index.
 */
export function matchAllSpells(
	spellcasting: Dnd5eSpellcasting | undefined,
	nimbleSpells: NimbleSpellIndexEntry[],
): SpellMatchResult[] {
	if (!spellcasting) return [];

	const allSpellNames = spellcasting.spells.flatMap((group) => group.names);
	return allSpellNames.map((name) => matchSpell(name, nimbleSpells));
}

/**
 * Load the Nimble spell compendium index.
 * Must be called in a Foundry context (uses game.packs).
 */
export async function loadNimbleSpellIndex(): Promise<NimbleSpellIndexEntry[]> {
	const pack = game.packs?.get('nimble.spells');
	if (!pack) return [];

	const index = await pack.getIndex({ fields: ['name'] });
	const entries: NimbleSpellIndexEntry[] = [];

	for (const entry of index) {
		const name = (entry as { name?: string }).name;
		if (name) {
			entries.push({
				name,
				uuid: `Compendium.nimble.spells.Item.${(entry as { _id: string })._id}`,
			});
		}
	}

	return entries;
}
