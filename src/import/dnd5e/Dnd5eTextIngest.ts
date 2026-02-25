/**
 * Parse plain text D&D 5e statblocks into the normalized Dnd5eStatblock intermediate format.
 * Handles text pasted from PDFs, D&D Beyond, SRD documents, etc.
 */

import { DND5E_SIZE_MAP, TEXT_PATTERNS } from './constants.js';
import { parseAttackFromDescription } from './Dnd5eJsonIngest.js';
import type {
	Dnd5eAbilityScore,
	Dnd5eSpellGroup,
	Dnd5eStatblock,
	Dnd5eStatblockAction,
	Dnd5eStatblockTrait,
} from './types.js';

// ─── Line-based Section Parser ───────────────────────────────────────────────

type Section =
	| 'header'
	| 'stats'
	| 'abilities'
	| 'traits'
	| 'actions'
	| 'bonusActions'
	| 'reactions'
	| 'legendaryActions'
	| 'lairActions';

const SECTION_HEADER_MAP: Record<string, Section> = {
	actions: 'actions',
	'bonus actions': 'bonusActions',
	reactions: 'reactions',
	'legendary actions': 'legendaryActions',
	'mythic actions': 'legendaryActions',
	'lair actions': 'lairActions',
	'regional effects': 'lairActions',
};

interface ParseState {
	name: string;
	size: string;
	creatureType: string;
	alignment?: string;
	ac: number;
	acSource?: string;
	hp: number;
	hitDice?: string;
	movement: Record<string, number>;
	abilities: Record<string, Dnd5eAbilityScore>;
	saveProficiencies: string[];
	skills: Record<string, number>;
	damageResistances: string[];
	damageImmunities: string[];
	damageVulnerabilities: string[];
	conditionImmunities: string[];
	senses: string[];
	languages: string[];
	cr: number;
	xp?: number;
	traits: Dnd5eStatblockTrait[];
	actions: Dnd5eStatblockAction[];
	bonusActions: Dnd5eStatblockAction[];
	reactions: Dnd5eStatblockTrait[];
	legendaryPreamble?: string;
	legendaryEntries: Dnd5eStatblockTrait[];
	lairActions: Dnd5eStatblockTrait[];
	spellcastingText?: string;
}

function createEmptyState(): ParseState {
	return {
		name: 'Unknown Creature',
		size: 'medium',
		creatureType: '',
		ac: 10,
		hp: 1,
		movement: {},
		abilities: {},
		saveProficiencies: [],
		skills: {},
		damageResistances: [],
		damageImmunities: [],
		damageVulnerabilities: [],
		conditionImmunities: [],
		senses: [],
		languages: [],
		cr: 0,
		traits: [],
		actions: [],
		bonusActions: [],
		reactions: [],
		legendaryEntries: [],
		lairActions: [],
	};
}

/**
 * Detect if a line is a legendary actions preamble (the description paragraph)
 * vs an actual named entry. Preambles typically start with "The" and contain
 * "legendary action" — they're full sentences, not short trait names.
 */
function isLegendaryPreamble(line: string): boolean {
	// Match the trait name pattern to see what it captures
	const traitMatch = line.match(TEXT_PATTERNS.traitName);
	if (!traitMatch) return true; // Not a trait name → must be preamble

	// If the "name" captured is very long (>50 chars), it's likely a sentence, not a name
	if (traitMatch[1].length > 50) return true;

	// Preamble almost always starts with "The" and mentions legendary actions
	if (/^The\b/i.test(line) && /legendary action/i.test(line)) return true;

	return false;
}

// ─── Individual Line Parsers ─────────────────────────────────────────────────

function parseNameLine(line: string, state: ParseState): void {
	state.name = line.trim();
}

function parseSizeTypeLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.sizeTypeLine);
	if (!match) return false;

	state.size = DND5E_SIZE_MAP[match[1].toLowerCase()] ?? 'medium';
	state.creatureType = match[2].trim();
	state.alignment = match[4]?.trim();
	return true;
}

function parseACLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.ac);
	if (!match) return false;
	state.ac = parseInt(match[1], 10);
	state.acSource = match[2] ?? undefined;
	return true;
}

function parseHPLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.hp);
	if (!match) return false;
	state.hp = parseInt(match[1], 10);
	state.hitDice = match[2] ?? undefined;
	return true;
}

function parseSpeedLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.speed);
	if (!match) return false;

	const speedText = match[1];
	const speeds: Record<string, number> = {};

	const partRegex = /(?:(\w+)\s+)?(\d+)\s*ft\.?/gi;
	let partMatch: RegExpExecArray | null;
	let isFirst = true;
	while ((partMatch = partRegex.exec(speedText)) !== null) {
		const mode = partMatch[1]?.toLowerCase() ?? (isFirst ? 'walk' : undefined);
		if (mode) {
			speeds[mode] = parseInt(partMatch[2], 10);
		}
		isFirst = false;
	}

	state.movement = speeds;
	return true;
}

function parseAbilityScores(lines: string[], startIdx: number, state: ParseState): number {
	// Look for the header line "STR DEX CON INT WIS CHA"
	if (!TEXT_PATTERNS.abilityHeaders.test(lines[startIdx])) return startIdx;

	// The scores should be on the next line(s)
	const scoreLineIdx = startIdx + 1;
	if (scoreLineIdx >= lines.length) return startIdx;

	const scoreLine = lines[scoreLineIdx];
	const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
	const scores: { score: number; mod: number }[] = [];

	const scoreRegex = /(\d+)\s*\(\s*([+-]?\d+)\s*\)/g;
	let scoreMatch: RegExpExecArray | null;
	while ((scoreMatch = scoreRegex.exec(scoreLine)) !== null) {
		scores.push({
			score: parseInt(scoreMatch[1], 10),
			mod: parseInt(scoreMatch[2], 10),
		});
	}

	for (let i = 0; i < Math.min(scores.length, abilityKeys.length); i++) {
		state.abilities[abilityKeys[i]] = scores[i];
	}

	return scoreLineIdx; // consumed the score line
}

function parseSavesLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.saves);
	if (!match) return false;

	const saveRegex = /(\w{3})\s+\+(\d+)/gi;
	let saveMatch: RegExpExecArray | null;
	while ((saveMatch = saveRegex.exec(match[1])) !== null) {
		state.saveProficiencies.push(saveMatch[1].toLowerCase());
	}
	return true;
}

function parseSkillsLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.skills);
	if (!match) return false;

	const skillRegex = /([\w\s]+?)\s+\+(\d+)/gi;
	let skillMatch: RegExpExecArray | null;
	while ((skillMatch = skillRegex.exec(match[1])) !== null) {
		state.skills[skillMatch[1].trim().toLowerCase()] = parseInt(skillMatch[2], 10);
	}
	return true;
}

function parseDamageTraitsLine(line: string, pattern: RegExp, target: string[]): boolean {
	const match = line.match(pattern);
	if (!match) return false;
	const items = match[1]
		.split(/[,;]/)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	target.push(...items);
	return true;
}

function parseSensesLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.senses);
	if (!match) return false;
	state.senses = match[1]
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	return true;
}

function parseLanguagesLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.languages);
	if (!match) return false;
	const text = match[1].trim();
	if (text === '—' || text === '-' || text.toLowerCase() === 'none') {
		state.languages = [];
	} else {
		state.languages = text
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return true;
}

function parseChallengeLine(line: string, state: ParseState): boolean {
	const match = line.match(TEXT_PATTERNS.challenge);
	if (!match) return false;

	const crStr = match[1];
	if (crStr.includes('/')) {
		const [num, den] = crStr.split('/').map(Number);
		state.cr = num / den;
	} else {
		state.cr = parseInt(crStr, 10);
	}

	if (match[2]) {
		state.xp = parseInt(match[2].replace(/,/g, ''), 10);
	}
	return true;
}

// ─── Trait / Action Parsing ──────────────────────────────────────────────────

function parseTraitBlock(
	lines: string[],
	startIdx: number,
): { trait: Dnd5eStatblockTrait; endIdx: number } | null {
	const firstLine = lines[startIdx].trim();
	if (!firstLine) return null;

	const nameMatch = firstLine.match(TEXT_PATTERNS.traitName);
	if (!nameMatch) return null;

	const name = nameMatch[1].trim();
	let description = firstLine.slice(nameMatch[0].length).trim();

	// Collect continuation lines (lines that don't start a new trait or section)
	let endIdx = startIdx;
	for (let i = startIdx + 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) break; // blank line ends the block
		if (TEXT_PATTERNS.sectionHeader.test(line)) break;
		if (TEXT_PATTERNS.traitName.test(line)) break;
		description += ` ${line}`;
		endIdx = i;
	}

	return { trait: { name, description: description.trim() }, endIdx };
}

function parseActionBlock(
	lines: string[],
	startIdx: number,
): { action: Dnd5eStatblockAction; endIdx: number } | null {
	const result = parseTraitBlock(lines, startIdx);
	if (!result) return null;

	const { trait, endIdx } = result;
	const parsed = parseAttackFromDescription(trait.description);

	return {
		action: { name: trait.name, description: trait.description, parsed },
		endIdx,
	};
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a plain text 5e statblock into the normalized intermediate format.
 */
export function ingestText(input: string): Dnd5eStatblock {
	const rawLines = input.split(/\r?\n/);
	const lines = rawLines.map((l) => l.trimEnd());
	const state = createEmptyState();

	let currentSection: Section = 'header';
	let headerLineParsed = false;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i].trim();

		// Skip blank lines (but they can mark section transitions)
		if (!line) {
			i++;
			continue;
		}

		// Check for section headers
		const sectionMatch = line.match(TEXT_PATTERNS.sectionHeader);
		if (sectionMatch) {
			const sectionKey = sectionMatch[1].toLowerCase();
			currentSection = SECTION_HEADER_MAP[sectionKey] ?? 'traits';
			i++;
			// For legendary actions, the first non-empty line after header is the preamble
			if (currentSection === 'legendaryActions') {
				const nextLine = lines[i]?.trim();
				if (nextLine && isLegendaryPreamble(nextLine)) {
					state.legendaryPreamble = nextLine;
					i++;
				}
			}
			continue;
		}

		// Parse based on current section
		switch (currentSection) {
			case 'header': {
				// First non-blank line is the name
				if (!headerLineParsed) {
					// Try to parse as size/type line first (in case name was already parsed)
					if (!parseSizeTypeLine(line, state)) {
						parseNameLine(line, state);
					} else {
						headerLineParsed = true;
					}
					i++;
					continue;
				}

				if (!headerLineParsed && parseSizeTypeLine(line, state)) {
					headerLineParsed = true;
					i++;
					continue;
				}

				// Parse stat lines
				if (parseACLine(line, state)) {
					i++;
					continue;
				}
				if (parseHPLine(line, state)) {
					i++;
					continue;
				}
				if (parseSpeedLine(line, state)) {
					i++;
					continue;
				}

				// Ability scores
				if (TEXT_PATTERNS.abilityHeaders.test(line)) {
					i = parseAbilityScores(lines, i, state) + 1;
					currentSection = 'stats';
					continue;
				}

				// If we can't parse this line as header content, move to traits
				currentSection = 'stats';
				continue;
			}

			case 'stats': {
				// These appear after ability scores
				if (parseSavesLine(line, state)) {
					i++;
					continue;
				}
				if (parseSkillsLine(line, state)) {
					i++;
					continue;
				}
				if (parseDamageTraitsLine(line, TEXT_PATTERNS.damageResistances, state.damageResistances)) {
					i++;
					continue;
				}
				if (parseDamageTraitsLine(line, TEXT_PATTERNS.damageImmunities, state.damageImmunities)) {
					i++;
					continue;
				}
				if (
					parseDamageTraitsLine(
						line,
						TEXT_PATTERNS.damageVulnerabilities,
						state.damageVulnerabilities,
					)
				) {
					i++;
					continue;
				}
				if (
					parseDamageTraitsLine(line, TEXT_PATTERNS.conditionImmunities, state.conditionImmunities)
				) {
					i++;
					continue;
				}
				if (parseSensesLine(line, state)) {
					i++;
					continue;
				}
				if (parseLanguagesLine(line, state)) {
					i++;
					continue;
				}
				if (parseChallengeLine(line, state)) {
					i++;
					currentSection = 'traits';
					continue;
				}

				// Unknown stat line — move to traits
				currentSection = 'traits';
				continue;
			}

			case 'traits': {
				const result = parseTraitBlock(lines, i);
				if (result) {
					// Check if this is a spellcasting feature
					if (result.trait.name.toLowerCase().includes('spellcasting')) {
						state.spellcastingText = result.trait.description;
					} else {
						state.traits.push(result.trait);
					}
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			case 'actions': {
				const result = parseActionBlock(lines, i);
				if (result) {
					state.actions.push(result.action);
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			case 'bonusActions': {
				const result = parseActionBlock(lines, i);
				if (result) {
					state.bonusActions.push(result.action);
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			case 'reactions': {
				const result = parseTraitBlock(lines, i);
				if (result) {
					state.reactions.push(result.trait);
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			case 'legendaryActions': {
				const result = parseTraitBlock(lines, i);
				if (result) {
					state.legendaryEntries.push(result.trait);
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			case 'lairActions': {
				const result = parseTraitBlock(lines, i);
				if (result) {
					state.lairActions.push(result.trait);
					i = result.endIdx + 1;
				} else {
					i++;
				}
				continue;
			}

			default:
				i++;
		}
	}

	// Parse spellcasting text if found
	const spellcasting = state.spellcastingText
		? parseSpellcastingText(state.spellcastingText)
		: undefined;

	return {
		name: state.name,
		size: state.size,
		creatureType: state.creatureType,
		alignment: state.alignment,
		ac: state.ac,
		acSource: state.acSource,
		hp: state.hp,
		hitDice: state.hitDice,
		movement: Object.keys(state.movement).length > 0 ? state.movement : { walk: 30 },
		abilities: state.abilities,
		saveProficiencies: state.saveProficiencies,
		skills: Object.keys(state.skills).length > 0 ? state.skills : undefined,
		damageResistances: state.damageResistances,
		damageImmunities: state.damageImmunities,
		damageVulnerabilities: state.damageVulnerabilities,
		conditionImmunities: state.conditionImmunities,
		senses: state.senses,
		languages: state.languages,
		cr: state.cr,
		xp: state.xp,
		traits: state.traits,
		actions: state.actions,
		bonusActions: state.bonusActions.length > 0 ? state.bonusActions : undefined,
		reactions: state.reactions.length > 0 ? state.reactions : undefined,
		legendaryActions:
			state.legendaryEntries.length > 0
				? { preamble: state.legendaryPreamble, entries: state.legendaryEntries }
				: undefined,
		lairActions: state.lairActions.length > 0 ? state.lairActions : undefined,
		spellcasting,
		sourceRaw: input,
	};
}

// ─── Spellcasting Text Parser ────────────────────────────────────────────────

function parseSpellcastingText(text: string): Dnd5eStatblock['spellcasting'] | undefined {
	let dc: number | undefined;
	let attackBonus: number | undefined;

	const dcMatch = text.match(/spell save DC (\d+)/i);
	if (dcMatch) dc = parseInt(dcMatch[1], 10);

	const atkMatch = text.match(/\+(\d+) to hit with spell/i);
	if (atkMatch) attackBonus = parseInt(atkMatch[1], 10);

	// Parse spell lists by level
	const spells: Dnd5eSpellGroup[] = [];

	// Cantrips: "Cantrips (at will): spell1, spell2"
	const cantripMatch = text.match(/Cantrips?\s*\(at will\)\s*:\s*([^\n]+)/i);
	if (cantripMatch) {
		spells.push({
			level: 0,
			names: cantripMatch[1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		});
	}

	// Leveled spells: "1st level (4 slots): spell1, spell2"
	const levelRegex = /(\d+)(?:st|nd|rd|th)\s+level\s*\((\d+)\s+slots?\)\s*:\s*([^\n]+)/gi;
	let levelMatch: RegExpExecArray | null;
	while ((levelMatch = levelRegex.exec(text)) !== null) {
		spells.push({
			level: parseInt(levelMatch[1], 10),
			slots: parseInt(levelMatch[2], 10),
			names: levelMatch[3]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		});
	}

	// Innate spellcasting: "At will: spell1, spell2"
	const atWillMatch = text.match(/At will\s*:\s*([^\n]+)/i);
	if (atWillMatch && !cantripMatch) {
		spells.push({
			level: 0,
			names: atWillMatch[1]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		});
	}

	// "X/day each: spell1, spell2"
	const perDayRegex = /(\d+)\/day(?:\s+each)?\s*:\s*([^\n]+)/gi;
	let perDayMatch: RegExpExecArray | null;
	while ((perDayMatch = perDayRegex.exec(text)) !== null) {
		spells.push({
			level: -1, // special marker for per-day spells
			slots: parseInt(perDayMatch[1], 10),
			names: perDayMatch[2]
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		});
	}

	if (spells.length === 0 && !dc && !attackBonus) return undefined;

	return { dc, attackBonus, spells };
}

// ─── Batch Text Parser ───────────────────────────────────────────────────────

/**
 * Split multiple statblocks from a single text input.
 * Statblocks are separated by "---" or multiple blank lines.
 */
export function splitTextBlocks(input: string): string[] {
	// Split on "---" separator
	const byDashes = input.split(/^-{3,}\s*$/m);
	if (byDashes.length > 1) {
		return byDashes.map((s) => s.trim()).filter(Boolean);
	}

	// Split on 3+ consecutive blank lines
	const byBlankLines = input.split(/\n{4,}/);
	if (byBlankLines.length > 1) {
		return byBlankLines.map((s) => s.trim()).filter(Boolean);
	}

	// Single block
	return [input.trim()].filter(Boolean);
}

/**
 * Parse a text input that may contain multiple statblocks.
 */
export function ingestTextBatch(input: string): Dnd5eStatblock[] {
	const blocks = splitTextBlocks(input);
	return blocks.map(ingestText);
}
