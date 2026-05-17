import type { EffectNode, PoolNode } from '#types/effectTree.js';
import type { UpcastResult } from '#types/spellScaling.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import SpellUpcastDialog from '../documents/dialogs/SpellUpcastDialog.svelte.js';
import { Predicate, type RawPredicate } from '../etc/Predicate.js';
import { isDebugModeEnabled } from '../settings/index.js';
import { keyPressStore } from '../stores/keyPressStore.js';
import {
	getDamageBonusFormulas,
	getDamageBonusTotal,
	hasWeaponProficiency,
} from '../utils/attackUtils.js';
import { adjustPool } from '../utils/chargePool/chargePoolRecover.js';
import { rollDieIntoPool, rollPoolFresh, setPoolFaces } from '../utils/dicePool/dicePoolRefill.js';
import getRollFormula from '../utils/getRollFormula.js';
import { normalizeDamageRollFormula } from '../utils/normalizeDamageRollFormula.js';
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

		// Get Targets — resolve the first target's domain for targetCondition evaluation
		const _targets = game.user?.targets.map((t) => t.document.uuid) ?? new Set<string>();
		const targetDomain = this.#getFirstTargetDomain();

		let rolls: (Roll | DamageRoll)[] = [];
		rolls = await this.#getRolls(dialogData, targetDomain);

		// Persist consumption of pool dice the player spent in the dialog.
		// The dialog already included their face value in rollFormula above.
		await this.#consumePoolDice(dialogData);
		await this.#consumeChargePools(dialogData);

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
	async #getRolls(
		dialogData: ItemActivationManager.DialogData,
		targetDomain?: Set<string>,
	): Promise<(Roll | DamageRoll)[]> {
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
		const actorSystem = this.actor?.system as
			| {
					healingPotionBonus?: number;
			  }
			| undefined;
		const healingBonus = isConsumable ? (actorSystem?.healingPotionBonus ?? 0) : 0;

		// Determine delivery (melee/ranged) and source (weapon/spell) for damage bonus filtering.
		// When attackType is empty (item has no attack), delivery is null and damage bonuses
		// are skipped entirely — non-attack items (consumables, utilities) should not receive
		// attack damage bonuses.
		const attackType = this.activationData?.targets?.attackType;
		const delivery = attackType === 'reach' ? 'melee' : attackType === 'range' ? 'ranged' : null;
		// Source classification: spells are 'spell', everything else (weapons, monster features,
		// class features) is 'weapon'. Monster features are physical attacks, not spells.
		const source = this.#item.type === 'spell' ? 'spell' : 'weapon';

		for (const node of flattenEffectsTree(effects)) {
			if (node.type === 'damage' || node.type === 'healing') {
				let roll: Roll | DamageRoll;

				if (node.type === 'damage' && !foundDamageRoll) {
					const { canCrit, canMiss } = node;
					const actorTags = (this.actor as { tags?: Set<string> } | null)?.tags;
					const isMinion =
						actorTags?.has('minion') ?? (this.actor?.type as string | undefined) === 'minion';

					// Flunkies cannot crit but can still miss, same as minions.
					const actorDetails = (this.actor?.system as { details?: { isFlunky?: boolean } } | null)
						?.details;
					const isFlunky = actorDetails?.isFlunky ?? false;

					// AoE attacks share a single roll applied to all targets,
					// so they cannot crit and cannot miss. Detect AoE from a
					// defined activation template shape.
					// Multi-target abilities WITHOUT a template (e.g. Magic Missile,
					// "make two attacks") roll separately per target and crit/miss
					// normally — targets.count alone is NOT a signal here.
					const activation = (this.#item.system as any)?.activation;
					const templateShape: string = activation?.template?.shape ?? '';
					const isAoE = templateShape !== '';

					// A wielder lacking proficiency in this weapon's type cannot crit.
					const lacksProficiency = !hasWeaponProficiency(this.actor as any, this.#item as any);

					const resolvedCanCrit =
						isAoE || isMinion || isFlunky || lacksProficiency ? false : (canCrit ?? true);
					// Minions cannot crit but can still miss — the asymmetry with
					// resolvedCanCrit above is intentional.
					const resolvedCanMiss = isAoE ? false : isMinion || (canMiss ?? true);
					node.rollMode = dialogData.rollMode ?? 0;

					// Check if item has vicious property
					const itemSystem = this.#item.system as { properties?: { selected?: string[] } };
					const isVicious = itemSystem.properties?.selected?.includes('vicious') ?? false;

					// Use modified formula if provided
					let formula = normalizeDamageRollFormula(dialogData.rollFormula || node.formula);

					// Apply damage bonuses filtered by delivery, source, damage type, and target
					if (delivery) {
						const numericBonus = getDamageBonusTotal(
							this.actor,
							delivery,
							source,
							node.damageType,
							targetDomain,
						);
						if (numericBonus > 0) {
							formula = `${formula} + ${numericBonus}`;
						}
						for (const diceFormula of getDamageBonusFormulas(
							this.actor,
							delivery,
							source,
							node.damageType,
							targetDomain,
						)) {
							formula = `${formula} + ${diceFormula}`;
						}
					}

					// Forward the optional rollMode source list so DamageRoll can
					// compute the net rollMode itself (advantage and disadvantage
					// cancel 1-for-1). Only attached when callers supplied the
					// array, to preserve backwards compatibility with single-source
					// callers (and existing constructor-call test expectations).
					const damageOptions: DamageRoll.Options & { rollModeSources?: number[] } = {
						canCrit: resolvedCanCrit,
						canMiss: resolvedCanMiss,
						rollMode: node.rollMode ?? 0,
						primaryDieValue: dialogData.primaryDieValue ?? 0,
						primaryDieModifier: Number(dialogData.primaryDieModifier) || 0,
						isVicious,
					};
					if (Array.isArray(this.#options.rollModeSources)) {
						damageOptions.rollModeSources = this.#options.rollModeSources;
					}

					roll = new dependencies.DamageRoll(
						formula,
						this.actor!.getRollData() as DamageRoll.Data,
						damageOptions,
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

			if (node.type === 'pool') {
				await this.#applyPoolNode(node as PoolNode);
			}

			updatedEffects.push(node);
		}

		// Updating the effects tree this way ensures that the changes above are reflected in the activation data.
		this.activationData.effects = dependencies.reconstructEffectsTree(updatedEffects);

		return rolls;
	}

	/**
	 * Persist consumption of pool dice the player spent in the activation dialog.
	 * The dialog already added their face values to the damage formula; this is
	 * the bookkeeping step that removes those faces from the pool's flag state.
	 *
	 * Indices in `consumedPoolDice` are dialog-snapshot indices — multiple dice
	 * from the same pool are removed in descending index order so earlier
	 * removals don't shift later indices.
	 */
	async #consumePoolDice(dialogData: ItemActivationManager.DialogData): Promise<void> {
		const consumed = dialogData.consumedPoolDice;
		if (!Array.isArray(consumed) || consumed.length < 1) return;

		const actor = this.actor as Actor.Implementation | null;
		if (!actor) return;

		const byPool = new Map<string, number[]>();
		for (const entry of consumed) {
			if (!entry || typeof entry.poolId !== 'string') continue;
			const indices = byPool.get(entry.poolId) ?? [];
			indices.push(entry.faceIndex);
			byPool.set(entry.poolId, indices);
		}

		for (const [poolId, indices] of byPool) {
			// Read current faces. Item-scoped pools live on the source item; we scan
			// items here since the dispatcher does the same elsewhere.
			let currentFaces: number[] | null = null;
			if (poolId.startsWith('actor:')) {
				const map = foundry.utils.getProperty(actor, 'flags.nimble.dicePools') as
					| Record<string, { faces?: number[] }>
					| undefined;
				const entry = map?.[poolId];
				currentFaces = Array.isArray(entry?.faces) ? [...entry.faces] : null;
			} else {
				for (const item of actor.items.contents) {
					const map = foundry.utils.getProperty(item, 'flags.nimble.dicePools') as
						| Record<string, { faces?: number[] }>
						| undefined;
					const entry = map?.[poolId];
					if (entry && Array.isArray(entry.faces)) {
						currentFaces = [...entry.faces];
						break;
					}
				}
			}
			if (!currentFaces) continue;

			const sortedIndices = [...indices].sort((a, b) => b - a);
			for (const index of sortedIndices) {
				if (index >= 0 && index < currentFaces.length) {
					currentFaces.splice(index, 1);
				}
			}

			await setPoolFaces(actor, poolId, currentFaces);
		}
	}

	/**
	 * Persist consumption of charge-pool charges the player spent in the dialog.
	 * The dialog already added `+Nd<size>[Label]` to the damage formula so the
	 * dice roll as part of the damage roll; this step decrements the charge
	 * pool's current count by the spent amount.
	 */
	async #consumeChargePools(dialogData: ItemActivationManager.DialogData): Promise<void> {
		const consumed = dialogData.consumedChargePools;
		if (!Array.isArray(consumed) || consumed.length < 1) return;

		const actor = this.actor as Actor.Implementation | null;
		if (!actor) return;

		for (const entry of consumed) {
			if (!entry || typeof entry.poolId !== 'string') continue;
			const count = Math.max(0, Math.floor(Number(entry.count) || 0));
			if (count < 1) continue;
			// adjustPool with negative-equivalent: 'add' supports only non-negative
			// values, so read current and 'set' to current - count.
			let currentValue = 0;
			for (const item of actor.items.contents) {
				const map = foundry.utils.getProperty(item, 'flags.nimble.chargePools') as
					| Record<string, { current?: number }>
					| undefined;
				const poolEntry = map?.[entry.poolId];
				if (poolEntry && typeof poolEntry.current === 'number') {
					currentValue = poolEntry.current;
					break;
				}
			}
			const next = Math.max(0, currentValue - count);
			await adjustPool(actor, entry.poolId, 'set', next);
		}
	}

	/**
	 * Apply a `pool` effect node: mutate a dice or charge pool on the source
	 * actor as a side effect of item activation. Records the outcome on the
	 * node itself so the chat-card renderer can display what happened.
	 *
	 * Routes by (poolType, action):
	 *   dice  + rollDie   -> roll `value` dice into the pool (one at a time)
	 *   dice  + rollPool  -> roll the full pool fresh (max dice)
	 *   dice  + clear     -> empty the pool
	 *   charge + fillCount -> add `value` charges (clamped to max)
	 *   charge + clear     -> set current to 0
	 *
	 * Skipped (with a skipReason) if predicate fails, actor missing, or the
	 * action is not meaningful for the pool type.
	 */
	async #applyPoolNode(node: PoolNode): Promise<void> {
		const actor = this.actor as Actor.Implementation | null;
		if (!actor) {
			node.result = { applied: false, skipReason: 'noActor' };
			return;
		}

		const rawPredicate = node.predicate;
		if (rawPredicate && Object.keys(rawPredicate).length > 0) {
			const predicate = new Predicate(rawPredicate as object as RawPredicate);
			const domain =
				(actor as { getDomain?: () => string[] | Set<string> }).getDomain?.() ?? new Set<string>();
			const domainSet = domain instanceof Set ? domain : new Set(domain);
			if (!predicate.test(domainSet)) {
				node.result = { applied: false, skipReason: 'predicate' };
				if (isDebugModeEnabled()) {
					const itemName = this.#item.name ?? node.poolIdentifier;
					ui.notifications?.info(
						game.i18n.format('NIMBLE.activationEffects.poolNode.debugPredicateSkipped', {
							item: itemName,
							pool: node.poolIdentifier,
							predicate: JSON.stringify(rawPredicate),
						}),
					);
				}
				return;
			}
		}

		const count = Math.max(0, Math.floor(Number(node.value) || 0));
		const poolId = node.poolIdentifier;

		if (node.poolType === 'dice') {
			const readPool = (): { label?: string; faces: number[] } => {
				// Item-scoped pools live on item.flags.nimble.dicePools[identifier];
				// actor-scoped pools (id "actor:identifier") live on actor.flags.nimble.dicePools.
				if (poolId.startsWith('actor:')) {
					const actorMap =
						(foundry.utils.getProperty(actor, 'flags.nimble.dicePools') as
							| Record<string, { label?: string; faces?: number[] }>
							| undefined) ?? {};
					const entry = actorMap[poolId];
					return { label: entry?.label, faces: Array.isArray(entry?.faces) ? entry.faces : [] };
				}
				for (const item of actor.items.contents) {
					const itemMap = foundry.utils.getProperty(item, 'flags.nimble.dicePools') as
						| Record<string, { label?: string; faces?: number[] }>
						| undefined;
					if (!itemMap) continue;
					const entry = itemMap[poolId];
					if (!entry) continue;
					return { label: entry.label, faces: Array.isArray(entry.faces) ? entry.faces : [] };
				}
				return { faces: [] };
			};

			if (node.action === 'rollDie') {
				const before = readPool();
				let applied = false;
				for (let i = 0; i < count; i += 1) {
					const ok = await rollDieIntoPool(actor, poolId);
					if (!ok) break;
					applied = true;
				}
				const after = readPool();
				node.result = {
					applied,
					poolLabel: after.label ?? before.label,
					previousCount: before.faces.length,
					newCount: after.faces.length,
					rolledFaces: after.faces.slice(before.faces.length),
				};
				return;
			}
			if (node.action === 'rollPool') {
				const before = readPool();
				const ok = await rollPoolFresh(actor, poolId);
				const after = readPool();
				node.result = {
					applied: ok,
					poolLabel: after.label ?? before.label,
					previousCount: before.faces.length,
					newCount: after.faces.length,
					rolledFaces: after.faces,
				};
				return;
			}
			if (node.action === 'clear') {
				const before = readPool();
				const ok = await setPoolFaces(actor, poolId, []);
				node.result = {
					applied: ok,
					poolLabel: before.label,
					previousCount: before.faces.length,
					newCount: 0,
				};
				return;
			}
			node.result = { applied: false, skipReason: 'invalidAction' };
			return;
		}

		if (node.poolType === 'charge') {
			const readChargePool = (): { label?: string; current: number } => {
				for (const item of actor.items.contents) {
					const map = foundry.utils.getProperty(item, 'flags.nimble.chargePools') as
						| Record<string, { label?: string; current?: number; identifier?: string }>
						| undefined;
					if (!map) continue;
					const entry = map[poolId];
					if (!entry) continue;
					return { label: entry.label, current: Number(entry.current) || 0 };
				}
				return { current: 0 };
			};

			if (node.action === 'fillCount') {
				const before = readChargePool();
				const ok = await adjustPool(actor, poolId, 'add', count);
				const after = readChargePool();
				node.result = {
					applied: ok,
					poolLabel: after.label ?? before.label,
					previousCount: before.current,
					newCount: after.current,
				};
				return;
			}
			if (node.action === 'clear') {
				const before = readChargePool();
				const ok = await adjustPool(actor, poolId, 'set', 0);
				node.result = {
					applied: ok,
					poolLabel: before.label,
					previousCount: before.current,
					newCount: 0,
				};
				return;
			}
			node.result = { applied: false, skipReason: 'invalidAction' };
			return;
		}

		node.result = { applied: false, skipReason: 'invalidAction' };
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
	 * Resolves the first targeted token's actor domain for targetCondition evaluation.
	 * Returns undefined if no targets are selected or the target has no domain.
	 */
	#getFirstTargetDomain(): Set<string> | undefined {
		const targets = game.user?.targets;
		if (!targets || targets.size === 0) return undefined;

		const firstTarget = targets.values().next().value as Token | undefined;
		const targetActor = firstTarget?.actor as { getDomain?: () => Set<string> } | null | undefined;
		return targetActor?.getDomain?.();
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
		/**
		 * Optional list of advantage/disadvantage source contributions. When
		 * provided, the manager sums them into a net rollMode (advantage and
		 * disadvantage cancel 1-for-1). Single-source callers can keep using
		 * `rollMode`.
		 */
		rollModeSources?: number[];
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
		/**
		 * Dice the player chose to spend from rolled dice pools (Fury, Judgment, etc).
		 * The dialog already appended the bonus to rollFormula; this list is used to
		 * persist the consumption back onto the pool after the damage roll succeeds.
		 */
		consumedPoolDice?: Array<{ poolId: string; faceIndex: number }>;
		/**
		 * Charges the player chose to spend from charge pools (Combat Dice, Mana
		 * Dice, etc). The dialog already appended `+Nd<size>[Label]` to rollFormula
		 * so the dice roll as part of the damage roll; this list decrements the
		 * pool's current count after the roll succeeds.
		 */
		consumedChargePools?: Array<{ poolId: string; count: number }>;
	}
}

export { ItemActivationManager };
