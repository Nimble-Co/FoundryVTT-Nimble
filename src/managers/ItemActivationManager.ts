import type { EffectNode } from '#types/effectTree.js';
import type { UpcastResult } from '#types/spellScaling.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import SpellUpcastDialog from '../documents/dialogs/SpellUpcastDialog.svelte.js';
import { keyPressStore } from '../stores/keyPressStore.js';
import getRollFormula from '../utils/getRollFormula.js';
import { applyUpcastDeltas } from '../utils/spell/applyUpcastDeltas.js';
import { flattenEffectsTree } from '../utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '../utils/treeManipulation/reconstructEffectsTree.js';

// Dependencies are grouped to allow tests to override them without relying on module mocking.
const dependencies = {
	NimbleRoll,
	DamageRoll,
	getRollFormula,
	reconstructEffectsTree,
};

export const testDependencies = dependencies;

/**
 * Normalizes and validates a damage roll formula string.
 *
 * This function cleans up potentially malformed damage formulas by:
 * - Trimming whitespace and normalizing multiple spaces
 * - Fixing common OCR/input errors in dice notation (e.g., 'O' -> '0', 'l' -> '1')
 * - Extracting valid dice expressions from complex strings
 * - Validating the resulting formula
 *
 * If the formula cannot be normalized to a valid roll formula, returns '0'.
 *
 * @param formula - The formula to normalize (may be malformed or contain errors).
 * @returns A valid, normalized roll formula string.
 */
function normalizeDamageRollFormula(formula: unknown): string {
	const normalized = typeof formula === 'string' ? formula.replace(/\s+/g, ' ').trim() : '';
	if (!normalized) return '0';

	const normalizedDiceFaces = normalized.replace(
		/\b(\d*)d([0-9oO|Il]+)\b/g,
		(_match, rawCount, rawFaces) => {
			const countValue = String(rawCount ?? '').replace(/[^0-9]/g, '');
			const facesValue = String(rawFaces ?? '')
				.replace(/[oO]/g, '0')
				.replace(/[^0-9]/g, '');
			const normalizedCount = countValue.length > 0 ? countValue : '1';
			const normalizedFaces = facesValue.length > 0 ? facesValue : '0';
			return `${normalizedCount}d${normalizedFaces}`;
		},
	);

	const validateFormula = (candidate: string): boolean => {
		const trimmed = candidate.trim();
		if (!trimmed) return false;
		try {
			return Roll.validate(trimmed);
		} catch {
			return false;
		}
	};

	if (validateFormula(normalizedDiceFaces)) return normalizedDiceFaces;

	const firstSegment =
		normalizedDiceFaces
			.split(/\s*(?:,|;|\bor\b)\s*/i)
			.map((segment) => segment.trim())
			.find((segment) => segment.length > 0) ?? '';
	if (firstSegment && validateFormula(firstSegment)) return firstSegment;

	const diceMatch = normalizedDiceFaces.match(/\b\d*d\d+(?:\s*[+-]\s*\d+)?\b/i);
	if (diceMatch) {
		const extracted = diceMatch[0].replace(/\s+/g, '');
		if (validateFormula(extracted)) return extracted;
	}

	return normalizedDiceFaces;
}

/**
 * Manages the activation of items (weapons, spells, abilities) including roll generation.
 *
 * ItemActivationManager orchestrates the complete item activation flow:
 * - Displaying configuration dialogs for roll options
 * - Handling spell upcasting and scaling
 * - Creating DamageRoll instances for damage effects
 * - Creating standard Roll instances for healing effects
 * - Processing effect trees and storing roll results
 *
 * The manager supports both interactive activation (with dialogs) and fast-forward
 * activation (skipping dialogs with predetermined options).
 *
 * @example
 * ```typescript
 * const manager = new ItemActivationManager(item, { fastForward: false });
 * const { rolls, activation } = await manager.getData();
 * // Use rolls for chat message, activation contains updated effect data
 * ```
 */
class ItemActivationManager {
	#item: NimbleBaseItem;

	#options: ItemActivationManager.ActivationOptions;

	/** The activation data from the item, potentially modified by upcasting. */
	activationData: any;

	/** Result of spell upcasting, if applicable. */
	upcastResult: UpcastResult | null = null;

	/**
	 * Creates a new ItemActivationManager.
	 *
	 * @param item - The item being activated.
	 * @param options - Configuration options for the activation.
	 */
	constructor(item: NimbleBaseItem, options: ItemActivationManager.ActivationOptions) {
		this.#item = item;
		this.#options = options;

		this.activationData = foundry.utils.deepClone(
			(item.system as { activation?: Record<string, unknown> }).activation ?? {},
		);
	}

	/**
	 * Gets the actor that owns the item being activated.
	 * @returns The actor, or null if the item has no parent actor.
	 */
	get actor() {
		return this.#item.actor;
	}

	/**
	 * Prepares and returns all data needed for item activation.
	 *
	 * This is the main entry point for item activation. It:
	 * 1. Determines if dialogs should be shown based on options and item type
	 * 2. Displays appropriate dialogs (ItemActivationConfigDialog or SpellUpcastDialog)
	 * 3. Applies upcast modifications for spells
	 * 4. Creates rolls for all damage and healing effects
	 * 5. Returns the rolls and updated activation data
	 *
	 * @returns Object containing `rolls` (array of Roll/DamageRoll), `activation` data,
	 *          and `rollHidden` flag. Returns `{ activation: null, rolls: null }` if cancelled.
	 */
	async getData() {
		const options = this.#options;

		const rollOptions = {
			domain: this.#getItemDomain(),
			executeMacro: options.executeMacro ?? false,
			rollMode: options.rollMode ?? 0,
		};

		let dialogData: ItemActivationManager.DialogData;

		if (options.fastForward) {
			dialogData = {
				rollMode: options.rollMode ?? 0,
				rollFormula: options.rollFormula,
				primaryDieValue: options.primaryDieValue,
				primaryDieModifier: options.primaryDieModifier,
				rollHidden: options.rollHidden,
			};
		} else {
			// Check if there are damage or healing effects that require rolling
			const effects = this.activationData?.effects ?? [];
			const hasRolls = flattenEffectsTree(effects).some(
				(node) => node.type === 'damage' || node.type === 'healing',
			);

			// Check if this is a spell (for upcast dialog)
			const isSpell = this.#item.type === 'spell';

			if (hasRolls || isSpell) {
				// Check if Alt is pressed to skip dialog
				let altPressed = false;
				const unsubscribe = keyPressStore.subscribe((state) => {
					altPressed = state.alt;
				});

				if (altPressed) {
					// Skip dialog, use default
					dialogData = this.#getDefaultDialogData(rollOptions);
				} else {
					// Use spell dialog for spells, regular dialog for others
					const DialogClass = isSpell ? SpellUpcastDialog : ItemActivationConfigDialog;

					const dialog = new DialogClass(
						this.actor,
						this.#item,
						`Activate ${this.#item.name}`,
						rollOptions,
					);
					await dialog.render(true);
					const result = await dialog.promise;
					if (result) {
						dialogData = result;
					} else {
						// If dialog is cancelled, don't roll
						return { activation: null, rolls: null };
					}
				}

				unsubscribe();
			} else {
				// No rolls needed, use default
				dialogData = this.#getDefaultDialogData(rollOptions);
			}
		}

		// Apply upcast deltas if present
		if (dialogData.upcast && this.#item.type === 'spell') {
			const spellSystem = this.#item.system as any;
			const actorSystem = this.actor!.system as any;
			const context = {
				spell: {
					tier: spellSystem.tier,
					scaling: spellSystem.scaling,
				},
				actor: {
					resources: {
						mana: {
							current: actorSystem.resources?.mana?.current || 0,
						},
						// In any case highestUnlockedSpellTier isn't set correctly we default to highest tier to ensure upcasting works
						highestUnlockedSpellTier: actorSystem.resources?.highestUnlockedSpellTier ?? 9,
					},
				},
				activationData: this.activationData,
				manaToSpend: dialogData.upcast.manaToSpend,
				choiceIndex: dialogData.upcast.choiceIndex,
			};

			try {
				const upcastData = applyUpcastDeltas(context);
				this.activationData = upcastData.activationData;
				this.upcastResult = upcastData.upcastResult;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				ui.notifications?.error(`Upcast failed: ${errorMessage}`);
				return { activation: null, rolls: null };
			}
		}

		// Get Targets
		const _targets = game.user?.targets.map((t) => t.document.uuid) ?? new Set<string>();

		let rolls: (Roll | DamageRoll)[] = [];
		rolls = await this.#getRolls(dialogData);

		// Get template data
		const _templateData = this.#getTemplateData();

		return { rolls, activation: this.activationData, rollHidden: dialogData.rollHidden ?? false };
	}

	/**
	 * Creates Roll instances for all damage and healing effects in the activation.
	 *
	 * Processes the effect tree and creates:
	 * - DamageRoll for the first damage effect (with critical/miss tracking)
	 * - Standard Roll for subsequent damage effects and all healing effects
	 *
	 * Special handling:
	 * - Skips rolling for certain item types (ancestry, background, boon, class, subclass)
	 * - Applies healing potion bonuses to consumable healing effects
	 * - Minions cannot score critical hits
	 *
	 * @param dialogData - Configuration from the activation dialog.
	 * @returns Array of evaluated Roll/DamageRoll instances.
	 */
	async #getRolls(dialogData: ItemActivationManager.DialogData): Promise<(Roll | DamageRoll)[]> {
		if (['ancestry', 'background', 'boon', 'class', 'subclass'].includes(this.#item.type))
			return [];

		const effects = this.activationData?.effects ?? [];
		const updatedEffects: EffectNode[] = [];
		const rolls: (Roll | DamageRoll)[] = [];
		let foundDamageRoll = false;

		// Check if item is a consumable (healing bonuses only apply to healing nodes, gated below)
		const itemSystem = this.#item.system as { objectType?: string };
		const isConsumable = itemSystem.objectType === 'consumable';

		// Get healing bonus from actor if applicable
		const actorSystem = this.actor?.system as { healingPotionBonus?: number } | undefined;
		const healingBonus = isConsumable ? (actorSystem?.healingPotionBonus ?? 0) : 0;

		for (const node of flattenEffectsTree(effects)) {
			if (node.type === 'damage' || node.type === 'healing') {
				let roll: Roll | DamageRoll;

				if (node.type === 'damage' && !foundDamageRoll) {
					const { canCrit, canMiss } = node;
					const actorTags = (this.actor as { tags?: Set<string> } | null)?.tags;
					const isMinion =
						actorTags?.has('minion') ?? (this.actor?.type as string | undefined) === 'minion';
					const resolvedCanCrit = isMinion ? false : (canCrit ?? true);
					const resolvedCanMiss = isMinion || (canMiss ?? true);
					node.rollMode = dialogData.rollMode ?? 0;

					// Use modified formula if provided
					const formula = normalizeDamageRollFormula(dialogData.rollFormula || node.formula);

					roll = new dependencies.DamageRoll(
						formula,
						this.actor!.getRollData() as DamageRoll.Data,
						{
							canCrit: resolvedCanCrit,
							canMiss: resolvedCanMiss,
							rollMode: node.rollMode ?? 0,
							primaryDieValue: dialogData.primaryDieValue ?? 0,
							primaryDieModifier: Number(dialogData.primaryDieModifier) || 0,
						},
					);

					foundDamageRoll = true;
				} else {
					let formula = node.formula || '0';

					// Apply healing bonus dice if applicable
					if (node.type === 'healing' && healingBonus > 0) {
						formula = this.#applyHealingBonus(formula, healingBonus);
					}

					roll = new Roll(formula, this.actor!.getRollData()) as Roll;
				}

				await roll.evaluate();
				node.roll = roll.toJSON() as Record<string, unknown>;
				rolls.push(roll);
			}

			updatedEffects.push(node);
		}

		// Updating the effects tree this way ensures that the changes above are reflected in the activation data.
		this.activationData.effects = dependencies.reconstructEffectsTree(updatedEffects);

		return rolls;
	}

	/**
	 * Adds bonus dice to a healing formula based on the healing bonus.
	 * For example, if formula is "2d4+4" and bonus is 1, returns "3d4+4"
	 *
	 * Note: Uses a non-global regex, so only the first dice group is modified.
	 * For formulas like "2d4+1d6", only the first group becomes "3d4+1d6".
	 * This is intentional for healing potions which typically have a single dice pool.
	 */
	#applyHealingBonus(formula: string, bonusDice: number): string {
		// Match dice notation like "2d4", "3d6", etc. (first occurrence only)
		const diceMatch = formula.match(/(\d*)d(\d+)/);
		if (!diceMatch) return formula;

		const currentCount = parseInt(diceMatch[1] || '1', 10);
		const diceSize = diceMatch[2];
		const newCount = currentCount + bonusDice;

		return formula.replace(/(\d*)d(\d+)/, `${newCount}d${diceSize}`);
	}

	/**
	 * Creates default dialog data when skipping the activation dialog.
	 *
	 * @param options - The roll options to use as defaults.
	 * @returns Default dialog data based on the provided options.
	 */
	#getDefaultDialogData(options): ItemActivationManager.DialogData {
		return {
			...options,
		};
	}

	/**
	 * Gets the domain set for modifier lookup.
	 *
	 * @returns A set of domain strings applicable to this item activation.
	 */
	#getItemDomain(): Set<string> {
		const domain = new Set<string>();

		return domain;
	}

	/**
	 * Gets measured template configuration data based on the item's area of effect.
	 *
	 * Creates template configuration for various shape types:
	 * - circle: Standard circular area
	 * - cone: Cone-shaped area with configurable angle
	 * - emanation: Circular area that scales with token size
	 * - line: Ray/line area with width
	 * - square: Square area (rendered as rotated rectangle)
	 *
	 * @returns Template configuration object, or undefined if no template shape is defined.
	 */
	#getTemplateData() {
		const item = this.#item;
		interface TemplateShape {
			shape?: string;
			radius?: number;
			length?: number;
			width?: number;
		}
		const { activation } = (item.system as { activation?: { template?: TemplateShape } }) ?? {};
		const template = activation?.template;
		const { shape } = template ?? {};

		if (!shape) return undefined;

		const templateData = {
			fillColor: game.user?.color,
			user: game.user?.id,
			x: 0,
			y: 0,
		};

		if (shape === 'circle') {
			return {
				...templateData,
				direction: 0,
				distance: template?.radius || 1,
				t: 'circle',
			};
		}

		if (shape === 'cone') {
			return {
				...templateData,
				angle: CONFIG.MeasuredTemplate.defaults.angle,
				direction: 0,
				distance: template?.length || 1,
				t: 'cone',
			};
		}

		if (shape === 'emanation') {
			const templateRadius = template?.radius || 1;
			const radiusFunc = (t: Token) => {
				const tokenSize = Math.max(t.document.width as number, t.document.height as number);
				const scaleBy = tokenSize / 2;
				return templateRadius + scaleBy;
			};

			return {
				...templateData,
				direction: 0,
				distance: radiusFunc,
				t: 'circle',
			};
		}

		if (shape === 'line') {
			return {
				...templateData,
				direction: 0,
				distance: template?.length || 1,
				t: 'ray',
				width: template?.width || 1,
			};
		}

		if (shape === 'square') {
			const width = template?.width || 1;
			return {
				...templateData,
				direction: 45,
				distance: Math.hypot(width, width),
				t: 'rect',
			};
		}

		return undefined;
	}
}

namespace ItemActivationManager {
	/**
	 * Options for configuring item activation behavior.
	 */
	export interface ActivationOptions {
		/** Whether to execute the item's custom macro after activation. */
		executeMacro?: boolean;
		/** Skip dialogs and use provided/default values directly. */
		fastForward?: boolean;
		/** Roll mode: positive for advantage, negative for disadvantage, 0 for normal. */
		rollMode?: number;
		/** How the roll should be displayed (public, private, blind, self). */
		visibilityMode?: keyof foundry.CONST.DICE_ROLL_MODES;
		/** Override formula for the damage roll. */
		rollFormula?: string;
		/** Predetermined value for the primary damage die. */
		primaryDieValue?: number;
		/** Modifier to apply to the primary die roll. */
		primaryDieModifier?: string;
		/** Whether to hide the roll from other players. */
		rollHidden?: boolean;
	}

	/**
	 * Data returned from the activation configuration dialog.
	 */
	export interface DialogData {
		/** Roll mode selected in the dialog. */
		rollMode: number | undefined;
		/** Modified roll formula from the dialog. */
		rollFormula?: string;
		/** Primary die value if predetermined. */
		primaryDieValue?: number;
		/** Modifier for the primary die. */
		primaryDieModifier?: string;
		/** Upcast configuration for spells. */
		upcast?: {
			/** Amount of mana to spend on upcasting. */
			manaToSpend: number;
			/** Index of the upcast choice selected. */
			choiceIndex?: number;
		};
		/** Whether to hide the roll. */
		rollHidden?: boolean;
	}
}

export { ItemActivationManager };
