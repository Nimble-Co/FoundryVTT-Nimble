import type { EffectNode } from '#types/effectTree.js';
import type { ScalingDelta, UpcastResult } from '#types/spellScaling.js';

export interface UpcastContext {
	spell: {
		tier: number;
		scaling: {
			mode: 'none' | 'upcast' | 'upcastChoice';
			deltas: ScalingDelta[];
			choices?: Array<{ label: string; deltas: ScalingDelta[] }> | null;
		} | null;
	};
	actor: {
		resources: {
			mana: {
				current: number;
			};
			highestUnlockedSpellTier: number;
		};
	};
	activationData: {
		effects: EffectNode[];
		targets?: { count: number; restrictions: string; attackType?: string; distance?: number };
		template?: { shape: string; radius?: number; length?: number; width?: number };
		duration?: { details: string; quantity: number; type: string };
	};
	manaToSpend: number;
	choiceIndex?: number;
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	upcastSteps: number;
	baseMana: number;
	totalMana: number;
}

export interface AppliedUpcastData {
	activationData: {
		effects: EffectNode[];
		targets?: { count: number; restrictions: string; attackType?: string; distance?: number };
		template?: { shape: string; radius?: number; length?: number; width?: number };
		duration?: { details: string; quantity: number; type: string };
	};
	upcastResult: UpcastResult;
}

/**
 * Validates upcasting constraints and computes upcast metadata
 */
export function validateAndComputeUpcast(context: UpcastContext): ValidationResult {
	const { spell, actor, manaToSpend } = context;

	// Rule 1: Only tiered spells (tier 1-9) can be upcast
	if (spell.tier === 0) {
		return {
			valid: false,
			error: 'Cantrips cannot be upcast',
			upcastSteps: 0,
			baseMana: 0,
			totalMana: 0,
		};
	}

	// Rule 2: Spell must have explicit scaling entry
	if (!spell.scaling || spell.scaling.mode === 'none') {
		return {
			valid: false,
			error: 'This spell cannot be upcast',
			upcastSteps: 0,
			baseMana: spell.tier,
			totalMana: spell.tier,
		};
	}

	// Rule 3: Base mana cost = spell tier
	const baseMana = spell.tier;

	// Rule 4: Cannot spend more than current mana
	if (manaToSpend > actor.resources.mana.current) {
		return {
			valid: false,
			error: 'Insufficient mana',
			upcastSteps: 0,
			baseMana,
			totalMana: manaToSpend,
		};
	}

	// Rule 5: Cannot spend less than base tier
	if (manaToSpend < baseMana) {
		return {
			valid: false,
			error: `Must spend at least ${baseMana} mana`,
			upcastSteps: 0,
			baseMana,
			totalMana: manaToSpend,
		};
	}

	// Rule 6: Cannot spend more than highest unlocked tier
	if (manaToSpend > actor.resources.highestUnlockedSpellTier) {
		return {
			valid: false,
			error: `Cannot spend more than ${actor.resources.highestUnlockedSpellTier} mana (highest unlocked tier)`,
			upcastSteps: 0,
			baseMana,
			totalMana: manaToSpend,
		};
	}

	// Rule 7: Upcast steps = manaSpent - baseTier
	const upcastSteps = manaToSpend - baseMana;

	return { valid: true, upcastSteps, baseMana, totalMana: manaToSpend };
}

/**
 * Applies scaling deltas to activation data (immutable - returns new object)
 * This is a PURE function - no side effects, no modifications to input
 */
export function applyUpcastDeltas(context: UpcastContext): AppliedUpcastData {
	const validation = validateAndComputeUpcast(context);

	if (!validation.valid) {
		throw new Error(validation.error || 'Invalid upcast configuration');
	}

	const { upcastSteps } = validation;

	// Deep clone activation data to ensure immutability
	const activationData = foundry.utils.deepClone(context.activationData);

	// Determine which deltas to apply
	let deltasToApply: ScalingDelta[];

	if (context.spell.scaling!.mode === 'upcastChoice') {
		if (context.choiceIndex === undefined || !context.spell.scaling!.choices) {
			throw new Error('Choice index required for upcastChoice mode');
		}
		const choice = context.spell.scaling!.choices[context.choiceIndex];
		if (!choice) {
			throw new Error(`Invalid choice index: ${context.choiceIndex}`);
		}
		deltasToApply = choice.deltas;
	} else {
		deltasToApply = context.spell.scaling!.deltas;
	}

	// Apply each delta, multiplied by upcastSteps
	for (const delta of deltasToApply) {
		applyDelta(activationData, delta, upcastSteps);
	}

	return {
		activationData,
		upcastResult: {
			isUpcast: upcastSteps > 0,
			manaSpent: validation.totalMana,
			upcastSteps,
			choiceIndex: context.choiceIndex,
			appliedDeltas: deltasToApply,
		},
	};
}

/**
 * Applies a single delta to activation data, scaled by upcastSteps
 */
function applyDelta(activationData: any, delta: ScalingDelta, upcastSteps: number): void {
	switch (delta.operation) {
		case 'addFlatDamage': {
			// Find damage effect (optionally by targetEffectId)
			const damageNode = findEffectNode(activationData.effects, 'damage', delta.targetEffectId);
			if (damageNode) {
				const amountToAdd = (delta.value || 0) * upcastSteps;
				// Append to formula
				damageNode.formula = `${damageNode.formula}+${amountToAdd}`;
			}
			break;
		}

		case 'addDice': {
			// Find damage or healing effect
			const effectNode =
				findEffectNode(activationData.effects, 'damage', delta.targetEffectId) ||
				findEffectNode(activationData.effects, 'healing', delta.targetEffectId);
			if (effectNode && delta.dice) {
				const diceToAdd = delta.dice.count * upcastSteps;
				const diceFaces = delta.dice.faces;
				// Append dice notation
				effectNode.formula = `${effectNode.formula}+${diceToAdd}d${diceFaces}`;
			}
			break;
		}

		case 'addReach': {
			if (activationData.targets && delta.value) {
				activationData.targets.distance =
					(activationData.targets.distance || 0) + delta.value * upcastSteps;
			}
			break;
		}

		case 'addRange': {
			if (activationData.targets && delta.value) {
				activationData.targets.distance =
					(activationData.targets.distance || 0) + delta.value * upcastSteps;
			}
			break;
		}

		case 'addTargets': {
			if (activationData.targets && delta.value) {
				activationData.targets.count += delta.value * upcastSteps;
			}
			break;
		}

		case 'addAreaSize': {
			if (activationData.template && delta.value) {
				if (activationData.template.radius !== undefined) {
					activationData.template.radius += delta.value * upcastSteps;
				}
				if (activationData.template.length !== undefined) {
					activationData.template.length += delta.value * upcastSteps;
				}
			}
			break;
		}

		case 'addDC': {
			// Find saving throw effect
			const saveNode = findEffectNode(activationData.effects, 'savingThrow', delta.targetEffectId);
			if (saveNode && delta.value) {
				saveNode.saveDC = (saveNode.saveDC || 0) + delta.value * upcastSteps;
			}
			break;
		}

		case 'addCondition': {
			// Add new condition node to effects
			if (delta.condition) {
				//TODO: Figure out how to handle conditions
				activationData.effects.push({
					id: foundry.utils.randomID(),
					type: 'condition',
					condition: delta.condition,
					parentContext: null,
					parentNode: null,
				});
			}
			break;
		}

		case 'addDuration': {
			if (activationData.duration && delta.value) {
				activationData.duration.quantity += delta.value * upcastSteps;
			}
			break;
		}

		case 'addArmor': {
			// TODO: Armor modifications affect the character, not activation data
			break;
		}

		default:
			console.warn(`Unknown scaling operation: ${delta.operation}`);
	}
}

/**
 * Helper to find effect node by type and optional ID
 */
function findEffectNode(effects: EffectNode[], type: string, targetId?: string | null): any {
	if (targetId) {
		return effects.find((e) => e.type === type && e.id === targetId);
	}
	return effects.find((e) => e.type === type);
}
