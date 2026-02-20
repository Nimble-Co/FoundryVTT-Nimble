/**
 * Parser for converting Nimble Nexus monster data to FoundryVTT Actor format
 */

import {
	DEFAULT_ACTOR_IMAGE,
	DEFAULT_FEATURE_ICONS,
	FEATURE_SUBTYPES,
	getMonsterImageUrl,
	levelToString,
	SAVE_STAT_MAP,
	saveValueToRollMode,
	SIZE_TO_TOKEN_DIMENSIONS,
} from './constants.js';
import { buildEffectTree, parseRangeReach } from './descriptionParser.js';
import type {
	ActorType,
	BatchImportResult,
	FoundrySaveStat,
	ImportOptions,
	ImportResult,
	NimbleNexusAbility,
	NimbleNexusAction,
	NimbleNexusMonster,
	NimbleNexusMonsterAttributes,
	NimbleNexusMovement,
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
	// Use the new smart parser to build effect tree
	let effects: object[] = buildEffectTree(action);

	// Fallback to original behavior if parsing fails or returns empty
	if (effects.length === 0 && action.damage?.roll) {
		effects = [
			{
				id: generateId(),
				type: 'damage',
				damageType: 'bludgeoning',
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
							parentNode: null,
						},
					],
				},
			},
		];
	}

	// Parse range/reach from description to supplement target info
	const rangeReach = parseRangeReach(action.description, action.target);

	let attackType = getAttackType(action.target);
	let distance = getAttackDistance(action.target);

	// Use parsed range/reach if target info is missing
	if (rangeReach && !action.target?.reach && !action.target?.range) {
		if (rangeReach.type === 'range') {
			attackType = 'range';
			distance = rangeReach.distance;
		} else if (rangeReach.type === 'reach') {
			attackType = rangeReach.distance > 1 ? 'reach' : '';
			distance = rangeReach.distance;
		}
	}

	// Determine template shape for area effects
	let templateShape = '';
	let templateLength = 1;
	let templateWidth = 1;
	let templateRadius = 1;
	let acquireTargetsFromTemplate = false;

	if (rangeReach) {
		if (rangeReach.type === 'cone') {
			templateShape = 'cone';
			templateLength = rangeReach.distance;
			acquireTargetsFromTemplate = true;
		} else if (rangeReach.type === 'line') {
			templateShape = 'line';
			templateLength = rangeReach.distance;
			templateWidth = rangeReach.width ?? 1;
			acquireTargetsFromTemplate = true;
		} else if (rangeReach.type === 'burst') {
			templateShape = 'burst';
			templateRadius = rangeReach.distance;
			acquireTargetsFromTemplate = true;
		}
	}

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
				acquireTargetsFromTemplate,
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
					length: templateLength,
					radius: templateRadius,
					shape: templateShape,
					width: templateWidth,
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
	const imageUrl = getMonsterImageUrl(attributes.paperforgeImageUrl);

	return {
		name: attributes.name,
		type: actorType,
		img: imageUrl,
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
				src: imageUrl,
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

		// Update prototype token image if actor has a custom image
		// Actor.create doesn't always properly apply nested prototypeToken.texture settings
		const imageUrl = getMonsterImageUrl(monster.attributes.paperforgeImageUrl);
		if (actor && imageUrl !== DEFAULT_ACTOR_IMAGE) {
			await actor.update({
				'prototypeToken.texture.src': imageUrl,
			} as object);
		}

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
 * NimbleNexusParser class providing a unified interface
 */
export class NimbleNexusParser {
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
}

// Export a singleton instance for convenience
export const nimbleNexusParser = new NimbleNexusParser();
