import type { EffectNode } from '#types/effectTree.js';
import type { ScalingDelta, UpcastResult } from '#types/spellScaling.js';
import { stepFormulaDieSize } from './stepFormulaDieSize.js';

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
	/**
	 * When false, the caster's current mana is not checked, so a cast the
	 * character cannot afford is still valid. Tier bounds are always enforced.
	 * Defaults to true.
	 */
	enforceManaCost?: boolean;
}

/** Why an upcast was refused. The caller turns this into a localized message. */
export type UpcastErrorCode =
	| 'cantripCannotUpcast'
	| 'spellCannotUpcast'
	| 'insufficientMana'
	| 'belowBaseTier'
	| 'aboveUnlockedTier';

/** Why an upcast was refused, and what its message needs. */
export interface UpcastRefusal {
	code: UpcastErrorCode;
	/** Values the message needs, already stringified. */
	data: Record<string, string>;
	/** For logs only; the caller localizes from `code`. */
	message: string;
}

export interface ValidationResult {
	valid: boolean;
	/** Set whenever `valid` is false, and only then. */
	refusal?: UpcastRefusal;
	upcastSteps: number;
	baseMana: number;
	totalMana: number;
}

/** Carries the refusal across the throw so the caller can localize it. */
export class UpcastError extends Error {
	refusal: UpcastRefusal;

	constructor(refusal: UpcastRefusal) {
		super(refusal.message);
		this.name = 'UpcastError';
		this.refusal = refusal;
	}
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
			refusal: {
				code: 'cantripCannotUpcast',
				data: {},
				message: 'Cantrips cannot be upcast',
			},
			upcastSteps: 0,
			baseMana: 0,
			totalMana: 0,
		};
	}

	// Rule 2: Spell must have explicit scaling entry
	if (!spell.scaling || spell.scaling.mode === 'none') {
		return {
			valid: false,
			refusal: {
				code: 'spellCannotUpcast',
				data: {},
				message: 'This spell cannot be upcast',
			},
			upcastSteps: 0,
			baseMana: spell.tier,
			totalMana: spell.tier,
		};
	}

	// Rule 3: Base mana cost = spell tier
	const baseMana = spell.tier;

	// Rule 4: Cannot spend more than current mana
	if ((context.enforceManaCost ?? true) && manaToSpend > actor.resources.mana.current) {
		return {
			valid: false,
			refusal: {
				code: 'insufficientMana',
				data: {
					current: String(actor.resources.mana.current),
					needed: String(manaToSpend),
				},
				message: 'Insufficient mana',
			},
			upcastSteps: 0,
			baseMana,
			totalMana: manaToSpend,
		};
	}

	// Rule 5: Cannot spend less than base tier
	if (manaToSpend < baseMana) {
		return {
			valid: false,
			refusal: {
				code: 'belowBaseTier',
				data: { min: String(baseMana) },
				message: `Must spend at least ${baseMana} mana`,
			},
			upcastSteps: 0,
			baseMana,
			totalMana: manaToSpend,
		};
	}

	// Rule 6: Cannot spend more than highest unlocked tier
	if (manaToSpend > actor.resources.highestUnlockedSpellTier) {
		return {
			valid: false,
			refusal: {
				code: 'aboveUnlockedTier',
				data: { maxTier: String(actor.resources.highestUnlockedSpellTier) },
				message: `Cannot spend more than ${actor.resources.highestUnlockedSpellTier} mana (highest unlocked tier)`,
			},
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
		if (!validation.refusal) throw new Error('An upcast was refused without a reason');
		throw new UpcastError(validation.refusal);
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
			choiceLabel:
				context.spell.scaling!.mode === 'upcastChoice' && context.choiceIndex !== undefined
					? context.spell.scaling!.choices?.[context.choiceIndex]?.label
					: undefined,
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

		case 'increaseDieSize': {
			// Find damage or healing effect
			const effectNode =
				findEffectNode(activationData.effects, 'damage', delta.targetEffectId) ||
				findEffectNode(activationData.effects, 'healing', delta.targetEffectId);
			if (effectNode) {
				// Enlarge the existing die instead of appending a new term
				const stepsToApply = (delta.value ?? 1) * upcastSteps;
				effectNode.formula = stepFormulaDieSize(
					effectNode.formula,
					stepsToApply,
					delta.maxDieFaces ?? null,
				);
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
 * Helper to find effect node by type and optional ID.
 * Searches recursively through nested nodes (e.g. damage inside savingThrow.on.failedSave).
 */
function findEffectNode(effects: EffectNode[], type: string, targetId?: string | null): any {
	for (const node of effects) {
		if (targetId) {
			if (node.type === type && node.id === targetId) return node;
		} else {
			if (node.type === type) return node;
		}

		// Traverse into nested nodes via "on" contexts (hit, miss, failedSave, etc.)
		if ('on' in node && node.on) {
			for (const key in node.on) {
				if (Object.hasOwn(node.on, key)) {
					const found = findEffectNode(node.on[key], type, targetId);
					if (found) return found;
				}
			}
		}

		// Traverse into shared rolls on saving throw nodes
		if ('sharedRolls' in node && node.sharedRolls) {
			const found = findEffectNode(node.sharedRolls as EffectNode[], type, targetId);
			if (found) return found;
		}
	}

	return null;
}
