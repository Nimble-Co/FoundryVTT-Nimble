/**
 * Parse Foundry dnd5e actor JSON into the normalized Dnd5eStatblock intermediate format.
 */

import type { ParsedDamage } from '../nimbleNexus/types.js';
import { DND5E_SIZE_MAP } from './constants.js';
import type {
	Dnd5eAbilityScore,
	Dnd5eActorJson,
	Dnd5eJsonItem,
	Dnd5eSpellcasting,
	Dnd5eSpellGroup,
	Dnd5eStatblock,
	Dnd5eStatblockAction,
	Dnd5eStatblockTrait,
	ParsedAttack,
} from './types.js';

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate that the input is a usable 5e actor JSON object.
 * Lenient: doesn't require all fields, just enough to be meaningful.
 */
export function validateJsonInput(
	raw: unknown,
): { valid: true; data: Dnd5eActorJson } | { valid: false; error: string } {
	if (raw === null || raw === undefined) {
		return { valid: false, error: 'Input is empty' };
	}
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		return { valid: false, error: 'Input must be a JSON object (not an array)' };
	}

	const obj = raw as Record<string, unknown>;

	if (!obj.name && !obj.system) {
		return {
			valid: false,
			error: 'Input must have at least a "name" or "system" property',
		};
	}

	return { valid: true, data: obj as Dnd5eActorJson };
}

/**
 * Try to parse a JSON string, returning the parsed value or an error.
 * Supports both single objects and arrays.
 */
export function parseJsonString(
	input: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, error: 'Input is empty' };
	}
	try {
		return { ok: true, value: JSON.parse(trimmed) };
	} catch (e) {
		return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
	}
}

// ─── Field Extractors ────────────────────────────────────────────────────────

function extractName(data: Dnd5eActorJson): string {
	return data.name ?? 'Unknown Creature';
}

function extractSize(data: Dnd5eActorJson): string {
	const raw = data.system?.traits?.size ?? 'med';
	return DND5E_SIZE_MAP[raw.toLowerCase()] ?? 'medium';
}

function extractCreatureType(data: Dnd5eActorJson): string {
	const typeField = data.system?.details?.type;
	if (!typeField) return '';
	if (typeof typeField === 'string') return typeField;
	return typeField.value ?? '';
}

function extractAlignment(data: Dnd5eActorJson): string | undefined {
	return data.system?.details?.alignment ?? undefined;
}

function extractAC(data: Dnd5eActorJson): { ac: number; source?: string } {
	const acField = data.system?.attributes?.ac;
	if (!acField) return { ac: 10 };

	// Handle different AC shapes
	const flat = (acField as { flat?: number }).flat;
	const value = (acField as { value?: number }).value;
	const calc = (acField as { calc?: string }).calc;

	const acValue = flat ?? value ?? 10;
	const source = calc && calc !== 'default' ? calc : undefined;

	return { ac: acValue, source };
}

function extractHP(data: Dnd5eActorJson): { hp: number; hitDice?: string } {
	const hpField = data.system?.attributes?.hp;
	if (!hpField) return { hp: 1 };

	const hp = hpField.max ?? hpField.value ?? 1;
	const hitDice = hpField.formula ?? undefined;

	return { hp, hitDice };
}

function extractMovement(data: Dnd5eActorJson): Record<string, number> {
	const mov = data.system?.attributes?.movement;
	if (!mov) return { walk: 30 };

	const result: Record<string, number> = {};
	const modes = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const;

	for (const mode of modes) {
		const val = mov[mode];
		if (val !== undefined && val !== null) {
			const num = typeof val === 'string' ? parseInt(val, 10) : val;
			if (num > 0) result[mode] = num;
		}
	}

	// Default to walk 30 if nothing found
	if (Object.keys(result).length === 0) result.walk = 30;

	return result;
}

function extractAbilities(data: Dnd5eActorJson): Record<string, Dnd5eAbilityScore> {
	const abilities = data.system?.abilities;
	if (!abilities) return {};

	const result: Record<string, Dnd5eAbilityScore> = {};
	for (const [key, ability] of Object.entries(abilities)) {
		const score = ability.value ?? 10;
		const mod = ability.mod ?? Math.floor((score - 10) / 2);
		result[key] = { score, mod };
	}
	return result;
}

function extractSaveProficiencies(data: Dnd5eActorJson): string[] {
	const abilities = data.system?.abilities;
	if (!abilities) return [];

	const proficient: string[] = [];
	for (const [key, ability] of Object.entries(abilities)) {
		if (ability.proficient && ability.proficient >= 1) {
			proficient.push(key);
		}
	}
	return proficient;
}

function extractTraitList(traits: { value?: string[]; custom?: string } | undefined): string[] {
	if (!traits) return [];
	const result = [...(traits.value ?? [])];
	if (traits.custom) {
		result.push(
			...traits.custom
				.split(';')
				.map((s) => s.trim())
				.filter(Boolean),
		);
	}
	return result;
}

function extractSenses(data: Dnd5eActorJson): string[] {
	const senses = data.system?.attributes?.senses;
	if (!senses) return [];

	const result: string[] = [];
	for (const [key, value] of Object.entries(senses)) {
		if (key === 'units' || key === 'special') continue;
		if (value && value !== 0 && value !== '0') {
			result.push(`${key} ${value} ft.`);
		}
	}
	return result;
}

function extractCR(data: Dnd5eActorJson): number {
	return data.system?.details?.cr ?? 0;
}

function extractXP(data: Dnd5eActorJson): number | undefined {
	return data.system?.details?.xp?.value ?? undefined;
}

function extractDescription(data: Dnd5eActorJson): string {
	return data.system?.details?.biography?.value ?? '';
}

// ─── Item / Action Extraction ────────────────────────────────────────────────

export function parseAttackFromDescription(description: string): ParsedAttack | undefined {
	const attackMatch = description.match(
		/(Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack:\s*\+(\d+)\s*to hit,\s*(?:reach|range)\s+(\d+)(?:\/(\d+))?\s*ft\./i,
	);
	if (!attackMatch) return undefined;

	const type = attackMatch[1].toLowerCase() as 'melee' | 'ranged';
	const toHit = parseInt(attackMatch[2], 10);
	const primaryDist = parseInt(attackMatch[3], 10);
	const longDist = attackMatch[4] ? parseInt(attackMatch[4], 10) : undefined;

	// Parse damage parts
	const damageParts: ParsedDamage[] = [];
	const damageRegex = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\)?\s+(\w+)\s+damage/gi;
	let damageMatch;
	while ((damageMatch = damageRegex.exec(description)) !== null) {
		damageParts.push({
			formula: damageMatch[1].replace(/\s+/g, ''),
			damageType: damageMatch[2].toLowerCase(),
		});
	}

	// Extract target text
	const targetMatch = description.match(/ft\.\s*,?\s*([^.]+?)\.\s*Hit/i);
	const targets = targetMatch?.[1]?.trim() ?? 'one target';

	// Extract rider text (everything after the last damage mention)
	const lastDamageIdx = description.lastIndexOf('damage');
	const riders =
		lastDamageIdx > 0
			? description
					.slice(lastDamageIdx + 'damage'.length)
					.replace(/^\s*[.,]\s*/, '')
					.trim() || undefined
			: undefined;

	return {
		type,
		toHit,
		reach: type === 'melee' ? primaryDist : undefined,
		range: type === 'ranged' ? primaryDist : undefined,
		longRange: longDist,
		targets,
		damage: damageParts,
		riders,
	};
}

function extractItemsAsTraits(
	items: Dnd5eJsonItem[],
	activationType: string,
): Dnd5eStatblockTrait[] {
	return items
		.filter((item) => item.system?.activation?.type === activationType)
		.filter((item) => !isWeaponAttack(item) && !isSpellcastingFeature(item))
		.map((item) => ({
			name: item.name ?? 'Unknown',
			description: item.system?.description?.value ?? '',
		}));
}

function isWeaponAttack(item: Dnd5eJsonItem): boolean {
	const actionType = item.system?.actionType;
	return (
		actionType === 'mwak' || actionType === 'rwak' || actionType === 'msak' || actionType === 'rsak'
	);
}

function isSpellcastingFeature(item: Dnd5eJsonItem): boolean {
	const name = (item.name ?? '').toLowerCase();
	return item.type === 'spell' || name === 'spellcasting' || name.includes('innate spellcasting');
}

function extractActions(items: Dnd5eJsonItem[]): Dnd5eStatblockAction[] {
	const actionItems = items.filter(
		(item) =>
			(item.system?.activation?.type === 'action' ||
				item.system?.activation?.type === 'bonus' ||
				!item.system?.activation?.type) &&
			!isSpellcastingFeature(item),
	);

	return actionItems.map((item) => {
		const description = item.system?.description?.value ?? '';
		const name = item.name ?? 'Unknown';
		let parsed: ParsedAttack | undefined;

		if (isWeaponAttack(item)) {
			// Try parsing from item data first
			parsed = parseAttackFromItemData(item);
			// Fall back to parsing from description text
			if (!parsed && description) {
				parsed = parseAttackFromDescription(description);
			}
		}

		// Add recharge info to name if present
		const recharge = item.system?.recharge?.value;
		const displayName = recharge != null ? `${name} (Recharge ${recharge}-6)` : name;

		return { name: displayName, description, parsed };
	});
}

function parseAttackFromItemData(item: Dnd5eJsonItem): ParsedAttack | undefined {
	const actionType = item.system?.actionType;
	if (!actionType) return undefined;

	const isRanged = actionType === 'rwak' || actionType === 'rsak';
	const type = isRanged ? 'ranged' : 'melee';

	const toHit =
		typeof item.system?.attackBonus === 'string'
			? parseInt(item.system.attackBonus, 10) || 0
			: (item.system?.attackBonus ?? 0);

	const rangeFeet = item.system?.range?.value ?? (isRanged ? 30 : 5);
	const longRange = item.system?.range?.long ?? undefined;

	const damage: ParsedDamage[] = [];
	if (item.system?.damage?.parts) {
		for (const [formula, damageType] of item.system.damage.parts) {
			if (formula) {
				damage.push({ formula, damageType: damageType || 'piercing' });
			}
		}
	}

	return {
		type,
		toHit,
		reach: type === 'melee' ? (rangeFeet ?? 5) : undefined,
		range: type === 'ranged' ? (rangeFeet ?? 30) : undefined,
		longRange: longRange ?? undefined,
		targets: 'one target',
		damage,
	};
}

function extractLegendaryActions(
	items: Dnd5eJsonItem[],
): { preamble?: string; entries: Dnd5eStatblockTrait[] } | undefined {
	const legendaryItems = items.filter((item) => item.system?.activation?.type === 'legendary');
	if (legendaryItems.length === 0) return undefined;

	return {
		entries: legendaryItems.map((item) => ({
			name: item.name ?? 'Unknown',
			description: item.system?.description?.value ?? '',
		})),
	};
}

function extractSpellcasting(items: Dnd5eJsonItem[]): Dnd5eSpellcasting | undefined {
	const spellItems = items.filter((item) => item.type === 'spell');
	if (spellItems.length === 0) return undefined;

	// Group spells by level (approximated from item data)
	const spellsByLevel = new Map<number, string[]>();
	for (const item of spellItems) {
		const name = item.name ?? 'Unknown Spell';
		// 5e spell items don't always have level in the same place; use 0 as fallback
		const level = 0;
		const existing = spellsByLevel.get(level) ?? [];
		existing.push(name);
		spellsByLevel.set(level, existing);
	}

	const spells: Dnd5eSpellGroup[] = [];
	for (const [level, names] of spellsByLevel.entries()) {
		spells.push({ level, names });
	}

	// Try to extract spellcasting ability from the spellcasting feature trait
	const scFeature = items.find((item) => {
		const name = (item.name ?? '').toLowerCase();
		return name === 'spellcasting' || name.includes('innate spellcasting');
	});

	let dc: number | undefined;
	let attackBonus: number | undefined;
	if (scFeature?.system?.description?.value) {
		const dcMatch = scFeature.system.description.value.match(/spell save DC (\d+)/i);
		if (dcMatch) dc = parseInt(dcMatch[1], 10);

		const atkMatch = scFeature.system.description.value.match(/\+(\d+) to hit with spell/i);
		if (atkMatch) attackBonus = parseInt(atkMatch[1], 10);
	}

	return { dc, attackBonus, spells };
}

// ─── Main Ingest Function ────────────────────────────────────────────────────

/**
 * Convert a validated 5e Foundry actor JSON into the normalized Dnd5eStatblock.
 */
export function ingestJson(data: Dnd5eActorJson, sourceRaw: string): Dnd5eStatblock {
	const items = data.items ?? [];
	const { ac, source: acSource } = extractAC(data);
	const { hp, hitDice } = extractHP(data);

	return {
		name: extractName(data),
		size: extractSize(data),
		creatureType: extractCreatureType(data),
		alignment: extractAlignment(data),
		ac,
		acSource,
		hp,
		hitDice,
		movement: extractMovement(data),
		abilities: extractAbilities(data),
		saveProficiencies: extractSaveProficiencies(data),
		damageResistances: extractTraitList(data.system?.traits?.dr),
		damageImmunities: extractTraitList(data.system?.traits?.di),
		damageVulnerabilities: extractTraitList(data.system?.traits?.dv),
		conditionImmunities: extractTraitList(data.system?.traits?.ci),
		languages: extractTraitList(data.system?.traits?.languages),
		senses: extractSenses(data),
		cr: extractCR(data),
		xp: extractXP(data),
		traits: extractItemsAsTraits(items, 'none').concat(extractItemsAsTraits(items, '')),
		actions: extractActions(items),
		reactions: extractItemsAsTraits(items, 'reaction'),
		legendaryActions: extractLegendaryActions(items),
		lairActions: extractItemsAsTraits(items, 'lair'),
		spellcasting: extractSpellcasting(items),
		description: extractDescription(data),
		sourceRaw,
	};
}

/**
 * Parse a raw JSON string and ingest it. Supports both single objects and arrays.
 * Returns an array of Dnd5eStatblock (one per monster).
 */
export function ingestJsonString(
	input: string,
): { ok: true; statblocks: Dnd5eStatblock[] } | { ok: false; error: string } {
	const parseResult = parseJsonString(input);
	if (!parseResult.ok) return parseResult;

	const { value } = parseResult;

	// Handle array input (batch)
	if (Array.isArray(value)) {
		const statblocks: Dnd5eStatblock[] = [];
		for (let i = 0; i < value.length; i++) {
			const validation = validateJsonInput(value[i]);
			if (!validation.valid) {
				return { ok: false, error: `Item ${i}: ${validation.error}` };
			}
			statblocks.push(ingestJson(validation.data, JSON.stringify(value[i])));
		}
		return { ok: true, statblocks };
	}

	// Handle single object
	const validation = validateJsonInput(value);
	if (!validation.valid) return { ok: false, error: validation.error };

	return { ok: true, statblocks: [ingestJson(validation.data, input)] };
}
