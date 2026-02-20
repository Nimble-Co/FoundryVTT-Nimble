/**
 * Parsing utilities for Nimble Nexus action descriptions
 * Extracts damage types, saving throws, conditions, and range/reach from action text
 */

import type {
	ConditionNode,
	DamageNode,
	DamageOutcomeNode,
	EffectNode,
	SavingThrowNode,
} from '#types/effectTree.js';
import {
	CONDITION_MAP,
	DAMAGE_TYPE_MAP,
	SAVE_TYPE_ABBREVIATION_MAP,
} from './constants.js';
import type {
	NimbleNexusAction,
	ParsedCondition,
	ParsedDamage,
	ParsedRangeReach,
	ParsedSaveType,
	ParsedSavingThrow,
} from './types.js';

/**
 * Generate a unique ID for effect nodes
 */
function generateId(): string {
	return foundry.utils.randomID(16);
}

/**
 * Extract the dice formula from a roll string, removing any damage type suffix
 * @param roll - The roll string, e.g., "5d8+13 Radiant" or "2d6+4"
 * @returns The cleaned dice formula, e.g., "5d8+13" or "2d6+4"
 */
export function extractDiceFormula(roll: string): string {
	if (!roll) return '';
	// Remove any trailing damage type (e.g., "5d8+13 Radiant" -> "5d8+13")
	// Match dice notation: digits, d, digits, optional modifier
	const formulaMatch = roll.match(/^([\d]+d[\d]+(?:[+-][\d]+)?)/i);
	return formulaMatch ? formulaMatch[1] : roll.trim();
}

/**
 * Parse damage type from a formula string and/or description
 * @param formula - The damage roll formula, may include damage type (e.g., "5d8+13 Radiant")
 * @param description - Optional action description to search for damage type
 * @returns The canonical damage type string
 */
export function parseDamageType(formula?: string, description?: string): string {
	// First, try to extract from formula (e.g., "5d8+13 Radiant")
	if (formula) {
		const formulaDamageMatch = formula.match(
			/[\d]+d[\d]+(?:[+-][\d]+)?\s+(\w+)/i,
		);
		if (formulaDamageMatch) {
			const extracted = formulaDamageMatch[1].toLowerCase();
			if (DAMAGE_TYPE_MAP[extracted]) {
				return DAMAGE_TYPE_MAP[extracted];
			}
		}
	}

	// Then, try to extract from description
	if (description) {
		const lowerDesc = description.toLowerCase();

		// Look for patterns like "fire damage", "deals necrotic damage", etc.
		const damagePatterns = [
			/(\w+)\s+damage/gi,
			/deals?\s+(\w+)/gi,
			/inflicts?\s+(\w+)/gi,
		];

		for (const pattern of damagePatterns) {
			const matches = [...lowerDesc.matchAll(pattern)];
			for (const match of matches) {
				const candidate = match[1].toLowerCase();
				if (DAMAGE_TYPE_MAP[candidate]) {
					return DAMAGE_TYPE_MAP[candidate];
				}
			}
		}

		// Look for standalone damage type words (e.g., "2d4+10 psychic, half on save")
		// Check for dice formula followed by damage type
		const formulaWithType = /\d+d\d+(?:[+-]\d+)?\s+(\w+)/gi;
		const formulaMatches = [...lowerDesc.matchAll(formulaWithType)];
		for (const match of formulaMatches) {
			const candidate = match[1].toLowerCase();
			if (DAMAGE_TYPE_MAP[candidate]) {
				return DAMAGE_TYPE_MAP[candidate];
			}
		}

		// Look for standalone damage types that appear after punctuation (e.g., "3d8+10. Slashing,")
		// This catches patterns like "Dice roll. DamageType, condition"
		const standaloneType = /[.,]\s*(\w+)[,.\s]/gi;
		const standaloneMatches = [...lowerDesc.matchAll(standaloneType)];
		for (const match of standaloneMatches) {
			const candidate = match[1].toLowerCase();
			if (DAMAGE_TYPE_MAP[candidate]) {
				return DAMAGE_TYPE_MAP[candidate];
			}
		}

		// Look for damage type at the start of description (e.g., "Fire. Cone 8.")
		const startType = /^(\w+)[.,\s]/i;
		const startMatch = lowerDesc.match(startType);
		if (startMatch && DAMAGE_TYPE_MAP[startMatch[1].toLowerCase()]) {
			return DAMAGE_TYPE_MAP[startMatch[1].toLowerCase()];
		}
	}

	// Default to bludgeoning if no type found
	return 'bludgeoning';
}

/**
 * Parse saving throw information from an action description
 * @param description - The action description text
 * @returns Parsed saving throw info, or null if none found
 */
export function parseSavingThrow(description?: string): ParsedSavingThrow | null {
	if (!description) return null;

	// Patterns to match (from real Nimble Nexus data):
	// "DC 15 DEX save"
	// "DC 21 Dexterity save"
	// "make a DC 10 STR saving throw"
	// "DC 15 STR save or take damage"
	// "DC 21 DEX save for half damage"
	// "Dex DC 20 save for half damage" (stat before DC)
	// "DC 10 WIL or 2d4+10 psychic" (no "save" after stat)
	const savePatterns = [
		// Standard: DC X STAT save
		/DC\s*(\d+)\s+(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+(?:saving\s+throw|save)/gi,
		// Make a DC: make a DC X STAT save
		/make\s+a\s+DC\s*(\d+)\s+(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+(?:saving\s+throw|save)/gi,
		// Stat before DC with save: Dex DC 20 save
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+DC\s*(\d+)\s+(?:saving\s+throw|save)/gi,
		// Shorthand without "save" keyword: DC X STAT or
		/DC\s*(\d+)\s+(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+or\b/gi,
		// Stat before DC with "or": Dex DC 13 or
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+DC\s*(\d+)\s+or\b/gi,
		// Stat before DC for half: Dex DC 15 for half
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+DC\s*(\d+)\s+for\s+half/gi,
		// Stat Save DC X: DEX Save DC 15 (stat before "Save DC")
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+Save\s+DC\s*(\d+)/gi,
		// Stat saving throw X or: Dex saving throw 13 or (no DC keyword)
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+saving\s+throw\s+(\d+)\s+or\b/gi,
		// Stat saving throw X (no DC keyword, end of pattern): Dex saving throw 13
		/(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)\s+saving\s+throw\s+(\d+)/gi,
	];

	for (let i = 0; i < savePatterns.length; i++) {
		const pattern = savePatterns[i];
		const match = pattern.exec(description);
		if (match) {
			let dc: number;
			let saveTypeRaw: string;

			// Patterns 2, 4, 5, 6, 7, 8 (stat before DC) have different capture group order
			if (i === 2 || i === 4 || i === 5 || i === 6 || i === 7 || i === 8) {
				saveTypeRaw = match[1].toLowerCase();
				dc = parseInt(match[2], 10);
			} else {
				dc = parseInt(match[1], 10);
				saveTypeRaw = match[2].toLowerCase();
			}

			const saveType = SAVE_TYPE_ABBREVIATION_MAP[saveTypeRaw];

			if (saveType) {
				// Check for "half damage" pattern - expanded to handle more variations
				const halfOnSave =
					/(?:for\s+)?half\s+damage/i.test(description) ||
					/half\s+(?:as\s+much\s+)?damage\s+on\s+(?:a\s+)?(?:successful|success|passed?)\b/i.test(
						description,
					) ||
					/(?:successful|success|passed?)\s+save\s+(?:takes?\s+)?half/i.test(description) ||
					/\bhalf\s+on\s+save\b/i.test(description) || // "(half on save)"
					/,\s*half\s+on\s+save\b/i.test(description); // ", half on save"

				// Try to extract consequence (what happens on failed save)
				let consequence: string | undefined;
				const consequenceMatch = description.match(
					/save\s+(?:or\s+)?(.+?)(?:\.|$)/i,
				);
				if (consequenceMatch && !halfOnSave) {
					consequence = consequenceMatch[1].trim();
				}

				return {
					dc,
					saveType,
					consequence,
					halfOnSave,
				};
			}
		}
	}

	return null;
}

/**
 * Parse conditions from an action description
 * Looks for bracket notation [[Condition]] and context patterns like "On hit:"
 * @param description - The action description text
 * @returns Array of parsed conditions
 */
export function parseConditions(description?: string): ParsedCondition[] {
	if (!description) return [];

	const conditions: ParsedCondition[] = [];

	// Pattern 1: Bracket notation [[Condition]]
	const bracketPattern = /\[\[(\w+)\]\]/gi;
	let bracketMatch: RegExpExecArray | null;
	while ((bracketMatch = bracketPattern.exec(description)) !== null) {
		const conditionRaw = bracketMatch[1].toLowerCase();
		const condition = CONDITION_MAP[conditionRaw];
		if (condition) {
			// Determine context based on surrounding text
			const beforeBracket = description
				.substring(0, bracketMatch.index)
				.toLowerCase();
			let context: ParsedCondition['context'] = 'hit';

			if (
				beforeBracket.includes('on crit') ||
				beforeBracket.includes('critical hit')
			) {
				context = 'criticalHit';
			} else if (
				beforeBracket.includes('failed save') ||
				beforeBracket.includes('fails the save') ||
				beforeBracket.includes('fail the save') ||
				beforeBracket.includes('save or') // "DC X save or <condition>"
			) {
				context = 'failedSave';
			}

			// Check for escape DC
			const escapePattern =
				/escape\s+DC\s*(\d+)\s*(STR|DEX|INT|WIL|WIS|strength|dexterity|intelligence|will|wisdom)?/gi;
			const escapeMatch = escapePattern.exec(description);
			let escapeDC: number | undefined;
			let escapeType: ParsedSaveType | undefined;
			if (escapeMatch) {
				escapeDC = parseInt(escapeMatch[1], 10);
				if (escapeMatch[2]) {
					escapeType = SAVE_TYPE_ABBREVIATION_MAP[escapeMatch[2].toLowerCase()];
				}
			}

			conditions.push({
				condition,
				context,
				escapeDC,
				escapeType,
			});
		}
	}

	// Pattern 2: "On hit: Condition" or "On crit: Condition"
	const contextPatterns = [
		{ pattern: /on\s+hit[:\s]+(\w+)/gi, context: 'hit' as const },
		{
			pattern: /on\s+crit(?:ical)?(?:\s+hit)?[:\s]+(\w+)/gi,
			context: 'criticalHit' as const,
		},
		{
			pattern: /on\s+(?:failed\s+)?save[:\s]+(\w+)/gi,
			context: 'failedSave' as const,
		},
	];

	for (const { pattern, context } of contextPatterns) {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(description)) !== null) {
			const conditionRaw = match[1].toLowerCase();
			const condition = CONDITION_MAP[conditionRaw];
			if (condition) {
				// Avoid duplicates
				if (
					!conditions.some(
						(c) => c.condition === condition && c.context === context,
					)
				) {
					conditions.push({
						condition,
						context,
					});
				}
			}
		}
	}

	// Pattern 3: "target is/becomes <condition>"
	const targetPattern =
		/target\s+(?:is|becomes?)\s+(\w+)/gi;
	let targetMatch: RegExpExecArray | null;
	while ((targetMatch = targetPattern.exec(description)) !== null) {
		const conditionRaw = targetMatch[1].toLowerCase();
		const condition = CONDITION_MAP[conditionRaw];
		if (condition) {
			// Check context from surrounding text
			const beforeMatch = description
				.substring(0, targetMatch.index)
				.toLowerCase();
			let context: ParsedCondition['context'] = 'hit';

			if (
				beforeMatch.includes('failed save') ||
				beforeMatch.includes('fails')
			) {
				context = 'failedSave';
			} else if (beforeMatch.includes('crit')) {
				context = 'criticalHit';
			}

			if (
				!conditions.some(
					(c) => c.condition === condition && c.context === context,
				)
			) {
				conditions.push({
					condition,
					context,
				});
			}
		}
	}

	return conditions;
}

/**
 * Parse range/reach information from description
 * @param description - The action description text
 * @param existingTarget - Existing target info from the action
 * @returns Parsed range/reach info, or null if none found
 */
export function parseRangeReach(
	description?: string,
	existingTarget?: { reach?: number; range?: number },
): ParsedRangeReach | null {
	// If we have existing target info, prefer that
	if (existingTarget?.range) {
		return { type: 'range', distance: existingTarget.range };
	}
	if (existingTarget?.reach) {
		return { type: 'reach', distance: existingTarget.reach };
	}

	if (!description) return null;

	// Pattern: (Range: 8), Range 8, Reach 3, Cone 6, Line 10x2
	const patterns = [
		{ pattern: /\(?\s*range[:\s]+(\d+)\s*\)?/gi, type: 'range' as const },
		{ pattern: /reach[:\s]+(\d+)/gi, type: 'reach' as const },
		{ pattern: /cone[:\s]+(\d+)/gi, type: 'cone' as const },
		{ pattern: /line[:\s]+(\d+)(?:x(\d+))?/gi, type: 'line' as const },
		{ pattern: /burst[:\s]+(\d+)/gi, type: 'burst' as const },
	];

	for (const { pattern, type } of patterns) {
		const match = pattern.exec(description);
		if (match) {
			const result: ParsedRangeReach = {
				type,
				distance: parseInt(match[1], 10),
			};
			if (match[2]) {
				result.width = parseInt(match[2], 10);
			}
			return result;
		}
	}

	return null;
}

/**
 * Parse damage information from action
 * @param action - The Nimble Nexus action object
 * @returns Parsed damage info, or null if none found
 */
export function parseDamage(action: NimbleNexusAction): ParsedDamage | null {
	if (!action.damage?.roll) return null;

	const formula = extractDiceFormula(action.damage.roll);
	const damageType = parseDamageType(action.damage.roll, action.description);

	return { formula, damageType };
}

/**
 * Create a DamageOutcomeNode
 */
function createDamageOutcomeNode(
	parentNode: string,
	context: string,
	outcome: 'fullDamage' | 'halfDamage' = 'fullDamage',
): DamageOutcomeNode {
	return {
		id: generateId(),
		type: 'damageOutcome',
		outcome,
		parentContext: context,
		parentNode,
	};
}

/**
 * Create a ConditionNode
 */
function createConditionNode(
	condition: string,
	parentNode: string | null,
	parentContext: string | null,
): ConditionNode {
	return {
		id: generateId(),
		type: 'condition',
		condition,
		parentContext,
		parentNode,
	};
}

/**
 * Create a DamageNode
 */
function createDamageNode(
	formula: string,
	damageType: string,
	parentNode: string | null = null,
	parentContext: string | null = null,
	options: {
		canCrit?: boolean;
		canMiss?: boolean;
		addHitOutcome?: boolean;
	} = {},
): DamageNode {
	const nodeId = generateId();
	const node: DamageNode = {
		id: nodeId,
		type: 'damage',
		damageType,
		formula,
		parentContext,
		parentNode,
	};

	if (options.canCrit !== undefined) node.canCrit = options.canCrit;
	if (options.canMiss !== undefined) node.canMiss = options.canMiss;

	if (options.addHitOutcome) {
		node.on = {
			hit: [createDamageOutcomeNode(nodeId, 'hit', 'fullDamage')],
		};
	}

	return node;
}

/**
 * Create a SavingThrowNode
 */
function createSavingThrowNode(
	saveInfo: ParsedSavingThrow,
	sharedRolls: DamageNode[] = [],
): SavingThrowNode {
	const nodeId = generateId();
	return {
		id: nodeId,
		type: 'savingThrow',
		savingThrowType: saveInfo.saveType,
		saveDC: saveInfo.dc,
		sharedRolls,
		on: {},
		parentContext: null,
		parentNode: null,
	};
}

/**
 * Build an effect tree from a Nimble Nexus action
 * This is the main function that orchestrates parsing and tree building
 * @param action - The Nimble Nexus action object
 * @returns Array of effect nodes for the action
 */
export function buildEffectTree(action: NimbleNexusAction): EffectNode[] {
	try {
		const effects: EffectNode[] = [];

		// Parse all components from the action
		const saveInfo = parseSavingThrow(action.description);
		const damageInfo = parseDamage(action);
		const conditions = parseConditions(action.description);

		// Case 1: Saving throw based action
		if (saveInfo) {
			const savingThrowNode = buildSavingThrowTree(
				saveInfo,
				damageInfo,
				conditions,
			);
			effects.push(savingThrowNode);
		}
		// Case 2: Damage-based action (attack)
		else if (damageInfo) {
			const damageNode = buildDamageTree(damageInfo, conditions);
			effects.push(damageNode);
		}
		// Case 3: Condition-only action
		else if (conditions.length > 0) {
			// Create a damage node as a "carrier" for conditions on hit
			// This is needed because conditions need a parent context
			for (const cond of conditions) {
				if (cond.context === 'hit') {
					effects.push(
						createConditionNode(cond.condition, null, null),
					);
				}
			}
		}

		return effects;
	} catch {
		// Graceful degradation: return empty array on error
		// The caller can fall back to the original behavior
		return [];
	}
}

/**
 * Build a saving throw tree with nested effects
 */
function buildSavingThrowTree(
	saveInfo: ParsedSavingThrow,
	damageInfo: ParsedDamage | null,
	conditions: ParsedCondition[],
): SavingThrowNode {
	const sharedRolls: DamageNode[] = [];

	// If there's damage, add it to shared rolls
	if (damageInfo) {
		const damageNodeId = generateId();
		const damageNode: DamageNode = {
			id: damageNodeId,
			type: 'damage',
			damageType: damageInfo.damageType,
			formula: damageInfo.formula,
			parentContext: 'sharedRolls',
			parentNode: null, // Will be set when we create the save node
		};

		// Add damage outcomes for failed/passed save
		damageNode.on = {
			failedSave: [createDamageOutcomeNode(damageNodeId, 'failedSave', 'fullDamage')],
		};

		if (saveInfo.halfOnSave) {
			damageNode.on.passedSave = [
				createDamageOutcomeNode(damageNodeId, 'passedSave', 'halfDamage'),
			];
		}

		sharedRolls.push(damageNode);
	}

	const saveNode = createSavingThrowNode(saveInfo, sharedRolls);

	// Set the parent node on shared rolls
	for (const roll of sharedRolls) {
		roll.parentNode = saveNode.id;
	}

	// Add conditions to the appropriate context
	const failedSaveConditions = conditions.filter(
		(c) => c.context === 'failedSave',
	);
	if (failedSaveConditions.length > 0) {
		saveNode.on ??= {};
		saveNode.on.failedSave ??= [];
		for (const cond of failedSaveConditions) {
			saveNode.on.failedSave.push(
				createConditionNode(cond.condition, saveNode.id, 'failedSave'),
			);
		}
	}

	return saveNode;
}

/**
 * Build a damage tree with nested effects for an attack
 */
function buildDamageTree(
	damageInfo: ParsedDamage,
	conditions: ParsedCondition[],
): DamageNode {
	const damageNode = createDamageNode(
		damageInfo.formula,
		damageInfo.damageType,
		null,
		null,
		{ canCrit: true, canMiss: true },
	);

	// Initialize the on property for consequences
	damageNode.on = {
		hit: [createDamageOutcomeNode(damageNode.id, 'hit', 'fullDamage')],
	};

	// Add conditions based on their context
	const hitConditions = conditions.filter((c) => c.context === 'hit');
	const critConditions = conditions.filter((c) => c.context === 'criticalHit');

	for (const cond of hitConditions) {
		damageNode.on.hit!.push(
			createConditionNode(cond.condition, damageNode.id, 'hit'),
		);
	}

	if (critConditions.length > 0) {
		damageNode.on.criticalHit = [];
		for (const cond of critConditions) {
			damageNode.on.criticalHit.push(
				createConditionNode(cond.condition, damageNode.id, 'criticalHit'),
			);
		}
	}

	return damageNode;
}
