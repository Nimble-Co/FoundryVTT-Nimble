/**
 * Parser for converting Nimbrew/nimble.nexus monster data to FoundryVTT Actor format
 */

import {
	DEFAULT_ACTOR_IMAGE,
	DEFAULT_FEATURE_ICONS,
	FEATURE_SUBTYPES,
	levelToString,
	SAVE_STAT_MAP,
	saveValueToRollMode,
	SIZE_TO_TOKEN_DIMENSIONS,
} from './constants.js';
import type {
	ActorType,
	BatchImportResult,
	FoundrySaveStat,
	ImportOptions,
	ImportResult,
	MonsterArmor,
	MonsterLevel,
	MonsterSize,
	NimbleNexusAbility,
	NimbleNexusAction,
	NimbleNexusMonster,
	NimbleNexusMonsterAttributes,
	NimbleNexusMovement,
	NimbrewJsonExport,
	SaveStat,
} from './types.js';

/**
 * Generate a unique ID for embedded items
 */
function generateId(): string {
	return foundry.utils.randomID(16);
}

/**
 * Determine the actor type based on monster attributes
 */
export function determineActorType(attributes: NimbleNexusMonsterAttributes): ActorType {
	if (attributes.legendary) return 'soloMonster';
	if (attributes.minion) return 'minion';
	return 'npc';
}

/**
 * Parse movement array to FoundryVTT movement object
 */
export function parseMovement(movement: NimbleNexusMovement[]): Record<string, number> {
	const result: Record<string, number> = {
		walk: 0,
		fly: 0,
		swim: 0,
		climb: 0,
		burrow: 0,
	};

	for (const m of movement) {
		if (m.mode) {
			// Named movement mode
			if (m.mode in result) {
				result[m.mode] = m.speed;
			}
		} else {
			// Default walking speed
			result.walk = m.speed;
		}
	}

	return result;
}

/**
 * Parse saves to FoundryVTT saving throws format
 */
export function parseSaves(
	saves?: Partial<Record<SaveStat, number>>,
): Record<FoundrySaveStat, { defaultRollMode: number; mod: number }> {
	const result: Record<FoundrySaveStat, { defaultRollMode: number; mod: number }> = {
		strength: { defaultRollMode: 0, mod: 0 },
		dexterity: { defaultRollMode: 0, mod: 0 },
		intelligence: { defaultRollMode: 0, mod: 0 },
		will: { defaultRollMode: 0, mod: 0 },
	};

	if (!saves) return result;

	for (const [apiStat, value] of Object.entries(saves)) {
		const foundryStat = SAVE_STAT_MAP[apiStat as SaveStat];
		if (foundryStat && typeof value === 'number') {
			result[foundryStat].defaultRollMode = saveValueToRollMode(value);
		}
	}

	return result;
}

/**
 * Parse a damage roll string to extract dice formula
 */
export function parseDamageRoll(roll: string): string {
	// The roll is already in dice format like "2d8+2"
	return roll;
}

/**
 * Determine attack type from target info
 */
function getAttackType(target?: { reach?: number; range?: number }): string {
	if (!target) return '';
	if (target.range) return 'range';
	if (target.reach && target.reach > 1) return 'reach';
	return '';
}

/**
 * Get attack distance from target info
 */
function getAttackDistance(target?: { reach?: number; range?: number }): number {
	if (!target) return 1;
	return target.range ?? target.reach ?? 1;
}

/**
 * Create a monster feature item from an ability
 */
export function createAbilityItem(ability: NimbleNexusAbility): object {
	return {
		_id: generateId(),
		name: ability.name,
		type: 'monsterFeature',
		img: DEFAULT_FEATURE_ICONS.feature,
		system: {
			macro: '',
			identifier: '',
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
			description: `<p>${ability.description}</p>`,
			subtype: FEATURE_SUBTYPES.feature,
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};
}

/**
 * Create a monster feature item from an action
 */
export function createActionItem(action: NimbleNexusAction, parentItemId?: string): object {
	const effects: object[] = [];

	// Add damage effect if present
	if (action.damage?.roll) {
		effects.push({
			id: generateId(),
			type: 'damage',
			damageType: 'piercing', // Default damage type
			formula: parseDamageRoll(action.damage.roll),
			parentContext: null,
			parentNode: null,
			canCrit: true,
			canMiss: true,
			on: {
				hit: [
					{
						id: generateId(),
						type: 'damageOutcome',
						outcome: 'fullDamage',
						parentContext: 'hit',
						parentNode: effects.length > 0 ? effects[0] : null,
					},
				],
			},
		});
	}

	const attackType = getAttackType(action.target);
	const distance = getAttackDistance(action.target);

	return {
		_id: generateId(),
		name: action.name,
		type: 'monsterFeature',
		img: DEFAULT_FEATURE_ICONS.action,
		system: {
			macro: '',
			identifier: '',
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
					type: 'action',
				},
				effects,
				showDescription: true,
				targets: {
					count: 1,
					restrictions: '',
					attackType,
					distance,
				},
				template: {
					length: 1,
					radius: 1,
					shape: '',
					width: 1,
				},
			},
			description: action.description ? `<p>${action.description}</p>` : '',
			subtype: FEATURE_SUBTYPES.action,
			parentItemId: parentItemId || '',
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};
}

/**
 * Create an attack sequence item (for actionsInstructions)
 */
export function createAttackSequenceItem(description: string): { item: object; id: string } {
	const id = generateId();
	return {
		id,
		item: {
			_id: id,
			name: 'Attack Sequence',
			type: 'monsterFeature',
			img: DEFAULT_FEATURE_ICONS.attackSequence,
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
				description: `<p>${description}</p>`,
				subtype: FEATURE_SUBTYPES.attackSequence,
				parentItemId: '',
			},
			effects: [],
			folder: null,
			sort: 0,
			flags: {},
		},
	};
}

/**
 * Create a bloodied phase item
 */
export function createBloodiedItem(description: string): object {
	return {
		_id: generateId(),
		name: 'Bloodied',
		type: 'monsterFeature',
		img: DEFAULT_FEATURE_ICONS.bloodied,
		system: {
			macro: '',
			identifier: '',
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
			description: `<p>${description}</p>`,
			subtype: FEATURE_SUBTYPES.bloodied,
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};
}

/**
 * Create a last stand phase item
 */
export function createLastStandItem(description: string): object {
	return {
		_id: generateId(),
		name: 'Last Stand',
		type: 'monsterFeature',
		img: DEFAULT_FEATURE_ICONS.lastStand,
		system: {
			macro: '',
			identifier: '',
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
			description: `<p>${description}</p>`,
			subtype: FEATURE_SUBTYPES.lastStand,
		},
		effects: [],
		folder: null,
		sort: 0,
		flags: {},
	};
}

/**
 * Create all monster feature items from monster attributes
 */
export function createMonsterFeatures(attributes: NimbleNexusMonsterAttributes): object[] {
	const items: object[] = [];

	// Add abilities (passive features)
	for (const ability of attributes.abilities) {
		items.push(createAbilityItem(ability));
	}

	// Determine if we need an attack sequence parent
	let attackSequenceId: string | undefined;
	if (attributes.actionsInstructions) {
		const { item, id } = createAttackSequenceItem(attributes.actionsInstructions);
		items.push(item);
		attackSequenceId = id;
	}

	// Add actions
	for (const action of attributes.actions) {
		items.push(createActionItem(action, attackSequenceId));
	}

	// Add bloodied phase for legendary monsters
	if (attributes.bloodied?.description) {
		items.push(createBloodiedItem(attributes.bloodied.description));
	}

	// Add last stand phase for legendary monsters
	if (attributes.lastStand?.description) {
		items.push(createLastStandItem(attributes.lastStand.description));
	}

	return items;
}

/**
 * Convert a NimbleNexus monster to FoundryVTT Actor.CreateData
 */
export function toActorData(monster: NimbleNexusMonster): Actor.CreateData {
	const { attributes } = monster;
	const actorType = determineActorType(attributes);
	const movement = parseMovement(attributes.movement);
	const savingThrows = parseSaves(attributes.saves);
	const items = createMonsterFeatures(attributes);
	const tokenDimensions = SIZE_TO_TOKEN_DIMENSIONS[attributes.size] ?? { width: 1, height: 1 };

	return {
		name: attributes.name,
		type: actorType,
		img: DEFAULT_ACTOR_IMAGE,
		system: {
			attributes: {
				armor: attributes.armor,
				damageResistances: [],
				damageVulnerabilities: [],
				damageImmunities: [],
				hp: {
					max: attributes.hp,
					temp: 0,
					value: attributes.hp,
				},
				sizeCategory: attributes.size,
				movement,
			},
			description: attributes.description || '',
			details: {
				creatureType: attributes.kind || '',
				level: levelToString(attributes.level),
				...(actorType === 'npc' && { isFlunky: false }),
			},
			savingThrows,
		},
		prototypeToken: {
			name: attributes.name,
			displayName: 50, // OWNER_HOVER
			actorLink: false,
			width: tokenDimensions.width,
			height: tokenDimensions.height,
			texture: {
				src: DEFAULT_ACTOR_IMAGE,
			},
			lockRotation: true,
			disposition: -1, // HOSTILE
			displayBars: actorType === 'soloMonster' ? 40 : 0, // OWNER for solo monsters
			bar1: {
				attribute: 'attributes.hp',
			},
		},
		items,
	} as object as Actor.CreateData;
}

/**
 * Import a single monster and create an Actor
 */
export async function importMonster(
	monster: NimbleNexusMonster,
	options: ImportOptions = {},
): Promise<ImportResult> {
	try {
		const actorData = toActorData(monster);

		// Set folder if provided
		if (options.folderId) {
			(actorData as Record<string, unknown>).folder = options.folderId;
		}

		const actor = await Actor.create(actorData);

		return {
			success: true,
			monsterName: monster.attributes.name,
			actorId: actor?.id ?? undefined,
		};
	} catch (error) {
		return {
			success: false,
			monsterName: monster.attributes.name,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Import multiple monsters
 */
export async function importBatch(
	monsters: NimbleNexusMonster[],
	options: ImportOptions = {},
): Promise<BatchImportResult> {
	let folderId = options.folderId;
	let createdFolderId: string | undefined;

	// Create folder if requested
	if (options.createFolder && options.folderName) {
		const folder = await Folder.create({
			name: options.folderName,
			type: 'Actor',
		});
		folderId = folder?.id ?? undefined;
		createdFolderId = folderId;
	}

	const results: ImportResult[] = [];

	for (const monster of monsters) {
		const result = await importMonster(monster, { ...options, folderId });
		results.push(result);
	}

	return { results, createdFolderId };
}

/**
 * Parse a Nimbrew JSON export file
 */
export function parseNimbrewJsonFile(jsonData: unknown): NimbleNexusMonster[] {
	if (!jsonData || typeof jsonData !== 'object') {
		throw new Error('Invalid JSON data');
	}

	const data = jsonData as NimbrewJsonExport;

	// Try different possible formats
	if (Array.isArray(data)) {
		// Direct array of monsters - check if it's Nimbrew format or API format
		return data.map((item) => convertToNimbleNexusMonster(item));
	}

	if (data.monsters && Array.isArray(data.monsters)) {
		return data.monsters.map((item) => convertToNimbleNexusMonster(item));
	}

	if (data.data && Array.isArray(data.data)) {
		return data.data.map((item) => convertToNimbleNexusMonster(item));
	}

	// Check if it's a single Nimbrew monster export (has 'name' and 'CR' or 'hp' at top level)
	if ('name' in data && ('CR' in data || 'hp' in data)) {
		return [convertNimbrewExportToMonster(data as NimbrewSingleExport)];
	}

	throw new Error('Could not find monsters in JSON data');
}

/**
 * Nimbrew single monster export format
 */
interface NimbrewSingleExport {
	name: string;
	CR?: string;
	armor?: string;
	hp?: string;
	saves?: string;
	speed?: string;
	passives?: Array<{ type?: string; name: string; desc: string }>;
	actions?: Array<{ type?: string; name: string; desc: string; status?: boolean }>;
	theme?: Record<string, string>;
}

/**
 * Convert any monster format to NimbleNexusMonster
 */
function convertToNimbleNexusMonster(item: unknown): NimbleNexusMonster {
	if (!item || typeof item !== 'object') {
		throw new Error('Invalid monster data');
	}

	const obj = item as Record<string, unknown>;

	// Check if it's already in NimbleNexusMonster format (has 'attributes' property)
	if ('attributes' in obj && obj.attributes && typeof obj.attributes === 'object') {
		return item as NimbleNexusMonster;
	}

	// Check if it's Nimbrew export format (has 'name' and 'CR' or 'hp')
	if ('name' in obj && ('CR' in obj || 'hp' in obj)) {
		return convertNimbrewExportToMonster(item as NimbrewSingleExport);
	}

	// Assume it's already in the correct format
	return item as NimbleNexusMonster;
}

/**
 * Convert Nimbrew export format to NimbleNexusMonster format
 */
function convertNimbrewExportToMonster(data: NimbrewSingleExport): NimbleNexusMonster {
	// Parse CR field: "Lvl 10, Large" -> level: 10, size: "large"
	let level: MonsterLevel = 1;
	let size: MonsterSize = 'medium';
	let legendary = false;
	let minion = false;

	if (data.CR) {
		const crMatch = data.CR.match(/Lvl\s*(\d+|1\/[234])/i);
		if (crMatch) {
			level = parseLevel(crMatch[1]);
		}

		const sizeMatch = data.CR.match(/\b(tiny|small|medium|large|huge|gargantuan)\b/i);
		if (sizeMatch) {
			size = parseSize(sizeMatch[1]);
		}

		// Check for legendary/solo or minion
		if (/\bsolo\b/i.test(data.CR) || /\blegendary\b/i.test(data.CR)) {
			legendary = true;
		}
		if (/\bminion\b/i.test(data.CR)) {
			minion = true;
		}
	}

	// Parse armor: "M" -> "medium", "H" -> "heavy", "N" or empty -> "none"
	let armor: MonsterArmor = 'none';
	if (data.armor) {
		const armorLower = data.armor.toLowerCase();
		if (armorLower === 'm' || armorLower === 'medium') {
			armor = 'medium';
		} else if (armorLower === 'h' || armorLower === 'heavy') {
			armor = 'heavy';
		}
	}

	// Parse HP
	const hp = parseInt(data.hp ?? '10', 10) || 10;

	// Parse speed
	const speed = parseInt(data.speed ?? '6', 10) || 6;

	// Convert passives to abilities
	const abilities: NimbleNexusAbility[] = (data.passives ?? []).map((p) => ({
		name: p.name,
		description: p.desc,
	}));

	// Convert actions
	const actions: NimbleNexusAction[] = (data.actions ?? []).map((a) => {
		// Try to extract damage dice from name or description
		const damageMatch =
			a.name.match(/(\d+d\d+(?:[+-]\d+)?)/i) || a.desc.match(/(\d+d\d+(?:[+-]\d+)?)/i);

		return {
			name: a.name.replace(/\s*\d+d\d+(?:[+-]\d+)?\s*/i, '').trim() || a.name,
			description: a.desc,
			damage: damageMatch ? { roll: damageMatch[1] } : undefined,
		};
	});

	return {
		id: generateId(),
		type: 'monsters',
		attributes: {
			name: data.name,
			hp,
			level,
			size,
			armor,
			legendary,
			minion,
			movement: [{ speed }],
			abilities,
			actions,
		},
	};
}

/**
 * NimbrewParser class providing a unified interface
 */
export class NimbrewParser {
	/**
	 * Determine actor type from monster attributes
	 */
	determineActorType(attributes: NimbleNexusMonsterAttributes): ActorType {
		return determineActorType(attributes);
	}

	/**
	 * Convert monster to actor data
	 */
	toActorData(monster: NimbleNexusMonster): Actor.CreateData {
		return toActorData(monster);
	}

	/**
	 * Import a single monster
	 */
	async importMonster(monster: NimbleNexusMonster, options?: ImportOptions): Promise<ImportResult> {
		return importMonster(monster, options);
	}

	/**
	 * Import multiple monsters
	 */
	async importBatch(
		monsters: NimbleNexusMonster[],
		options?: ImportOptions,
	): Promise<BatchImportResult> {
		return importBatch(monsters, options);
	}

	/**
	 * Parse a JSON export file
	 */
	parseJsonFile(jsonData: unknown): NimbleNexusMonster[] {
		return parseNimbrewJsonFile(jsonData);
	}

	/**
	 * Parse a markdown export file
	 */
	parseMarkdownFile(markdownContent: string): NimbleNexusMonster[] {
		return parseNimbleNexusMarkdownFile(markdownContent);
	}
}

/**
 * Parse a markdown file from Nimble Nexus
 * Supports both YAML frontmatter format and plain text format
 */
export function parseNimbleNexusMarkdownFile(content: string): NimbleNexusMonster[] {
	const monsters: NimbleNexusMonster[] = [];

	// Check if it's YAML frontmatter format
	if (content.trim().startsWith('---')) {
		const monster = parseYamlFrontmatterFormat(content);
		if (monster) monsters.push(monster);
	} else {
		// Try plain text format
		const monster = parsePlainTextFormat(content);
		if (monster) monsters.push(monster);
	}

	return monsters;
}

/**
 * Parse YAML frontmatter markdown format
 */
function parseYamlFrontmatterFormat(content: string): NimbleNexusMonster | null {
	// Extract YAML frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) return null;

	const frontmatter = frontmatterMatch[1];
	const body = content.slice(frontmatterMatch[0].length);

	// Parse frontmatter fields
	const name = extractYamlField(frontmatter, 'name')?.replace(/^["']|["']$/g, '') ?? 'Unknown';
	const level = parseLevel(extractYamlField(frontmatter, 'level') ?? '1');
	const role = extractYamlField(frontmatter, 'role') ?? '';
	const hp = parseInt(extractYamlField(frontmatter, 'hp') ?? '10', 10);
	const armor = parseArmor(extractYamlField(frontmatter, 'armor') ?? 'none');
	const size = parseSize(extractYamlField(frontmatter, 'size') ?? 'medium');

	// Parse body for speed, abilities, and actions
	const speed = extractSpeed(body);
	const abilities = extractAbilities(body);
	const actions = extractActions(body);

	return {
		id: generateId(),
		type: 'monsters',
		attributes: {
			name,
			hp,
			level,
			size,
			armor,
			role,
			legendary: false,
			minion: false,
			movement: [{ speed }],
			abilities,
			actions,
		},
	};
}

/**
 * Parse plain text markdown format
 */
function parsePlainTextFormat(content: string): NimbleNexusMonster | null {
	const lines = content.split('\n').map((l) => l.trim());

	// First line should be the name in **bold**
	const nameMatch = lines[0]?.match(/^\*\*(.+?)\*\*$/);
	if (!nameMatch) return null;
	const name = nameMatch[1];

	// Second line has Level, Size, Group
	const statsLine = lines[1] ?? '';
	const levelMatch = statsLine.match(/\*\*Level:\*\*\s*(\S+)/i);
	const sizeMatch = statsLine.match(/\*\*Size:\*\*\s*(\S+)/i);

	const level = parseLevel(levelMatch?.[1] ?? '1');
	const size = parseSize(sizeMatch?.[1] ?? 'medium');

	// Third line has HP, Armor, Speed
	const hpLine = lines[2] ?? '';
	const hpMatch = hpLine.match(/\*\*HP:\*\*\s*(\d+)/i);
	const armorMatch = hpLine.match(/\*\*Armor:\*\*\s*(\S+)/i);
	const speedMatch = hpLine.match(/\*\*Speed:\*\*\s*(\d+)/i);

	const hp = parseInt(hpMatch?.[1] ?? '10', 10);
	const armor = parseArmor(armorMatch?.[1] ?? 'none');
	const speed = parseInt(speedMatch?.[1] ?? '6', 10);

	// Parse abilities (under **Passive**)
	const abilities: NimbleNexusAbility[] = [];
	const actions: NimbleNexusAction[] = [];

	let currentSection = '';
	for (const line of lines) {
		if (line === '**Passive**') {
			currentSection = 'passive';
			continue;
		}
		if (line === '**Actions**') {
			currentSection = 'actions';
			continue;
		}

		if (currentSection === 'passive' && line.startsWith('*')) {
			const abilityMatch = line.match(/^\*\s*\*\*(.+?)\.\*\*\s*(.+)$/);
			if (abilityMatch) {
				abilities.push({
					name: abilityMatch[1],
					description: abilityMatch[2],
				});
			}
		}

		if (currentSection === 'actions' && line.startsWith('*')) {
			const actionMatch = line.match(/^\*\s*\*\*(.+?)\.\*\*\s*(.+)$/);
			if (actionMatch) {
				const actionName = actionMatch[1];
				const actionDesc = actionMatch[2];
				const damageMatch = actionDesc.match(/^(\d+d\d+(?:[+-]\d+)?)/);

				actions.push({
					name: actionName,
					description: actionDesc,
					damage: damageMatch ? { roll: damageMatch[1] } : undefined,
				});
			}
		}
	}

	return {
		id: generateId(),
		type: 'monsters',
		attributes: {
			name,
			hp,
			level,
			size,
			armor,
			legendary: false,
			minion: false,
			movement: [{ speed }],
			abilities,
			actions,
		},
	};
}

/**
 * Extract a field from YAML frontmatter
 */
function extractYamlField(yaml: string, field: string): string | undefined {
	const match = yaml.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
	return match?.[1]?.trim();
}

/**
 * Extract speed from markdown body
 */
function extractSpeed(body: string): number {
	const speedMatch = body.match(/\*\*Speed\*\*:\s*(\d+)/i) || body.match(/Speed:\s*(\d+)/i);
	return parseInt(speedMatch?.[1] ?? '6', 10);
}

/**
 * Extract abilities from markdown body
 */
function extractAbilities(body: string): NimbleNexusAbility[] {
	const abilities: NimbleNexusAbility[] = [];

	// Match ability patterns like "- **Name**: Description" or "### Name" followed by content
	const abilityMatches = body.matchAll(/-\s*\*\*(.+?)\*\*:\s*(.+)/g);
	for (const match of abilityMatches) {
		// Skip if it looks like an action (has damage dice)
		if (match[2].match(/^\d+d\d+/)) continue;
		abilities.push({
			name: match[1],
			description: match[2],
		});
	}

	return abilities;
}

/**
 * Extract actions from markdown body
 */
function extractActions(body: string): NimbleNexusAction[] {
	const actions: NimbleNexusAction[] = [];

	// Find the Actions section
	const actionsSection = body.match(/## Actions\n([\s\S]*?)(?=\n## |$)/i);
	if (!actionsSection) return actions;

	// Match action patterns like "- **Name** (damage): description"
	const actionMatches = actionsSection[1].matchAll(/-\s*\*\*(.+?)\*\*\s*\(([^)]+)\):\s*(.+)/g);
	for (const match of actionMatches) {
		const name = match[1];
		const damage = match[2];
		const description = match[3];

		// Parse range/reach from description
		const rangeMatch = description.match(/\(Range:\s*(\d+)\)/i);
		const reachMatch = description.match(/\(Reach:\s*(\d+)\)/i);

		actions.push({
			name,
			description,
			damage: { roll: damage },
			target: {
				range: rangeMatch ? parseInt(rangeMatch[1], 10) : undefined,
				reach: reachMatch ? parseInt(reachMatch[1], 10) : undefined,
			},
		});
	}

	return actions;
}

/**
 * Parse level string to MonsterLevel
 */
function parseLevel(levelStr: string): MonsterLevel {
	if (levelStr === '1/4') return '1/4';
	if (levelStr === '1/3') return '1/3';
	if (levelStr === '1/2') return '1/2';
	return parseInt(levelStr, 10) || 1;
}

/**
 * Parse armor string to MonsterArmor
 */
function parseArmor(armorStr: string): MonsterArmor {
	const lower = armorStr.toLowerCase();
	if (lower === 'heavy') return 'heavy';
	if (lower === 'medium') return 'medium';
	return 'none';
}

/**
 * Parse size string to MonsterSize
 */
function parseSize(sizeStr: string): MonsterSize {
	const lower = sizeStr.toLowerCase();
	if (lower === 'tiny') return 'tiny';
	if (lower === 'small') return 'small';
	if (lower === 'large') return 'large';
	if (lower === 'huge') return 'huge';
	if (lower === 'gargantuan') return 'gargantuan';
	return 'medium';
}

// Export a singleton instance for convenience
export const nimbrewParser = new NimbrewParser();
