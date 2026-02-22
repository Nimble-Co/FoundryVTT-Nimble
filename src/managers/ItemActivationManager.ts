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

class ItemActivationManager {
	#item: NimbleBaseItem;

	#options: ItemActivationManager.ActivationOptions;

	activationData: any;

	upcastResult: UpcastResult | null = null;

	constructor(item: NimbleBaseItem, options: ItemActivationManager.ActivationOptions) {
		this.#item = item;
		this.#options = options;

		this.activationData = foundry.utils.deepClone(
			(item.system as { activation?: Record<string, unknown> }).activation ?? {},
		);
	}

	get actor() {
		return this.#item.actor;
	}

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
						highestUnlockedSpellTier: actorSystem.resources?.highestUnlockedSpellTier || 0,
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

	async #getRolls(dialogData: ItemActivationManager.DialogData): Promise<(Roll | DamageRoll)[]> {
		if (['ancestry', 'background', 'boon', 'class', 'subclass'].includes(this.#item.type))
			return [];

		const effects = this.activationData?.effects ?? [];
		const updatedEffects: EffectNode[] = [];
		const rolls: (Roll | DamageRoll)[] = [];
		let foundDamageRoll = false;

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
					roll = new Roll(node.formula || '0', this.actor!.getRollData()) as Roll;
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

	#getDefaultDialogData(options): ItemActivationManager.DialogData {
		return {
			...options,
		};
	}

	#getItemDomain(): Set<string> {
		const domain = new Set<string>();

		return domain;
	}

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
	export interface ActivationOptions {
		executeMacro?: boolean;
		fastForward?: boolean;
		rollMode?: number;
		visibilityMode?: keyof foundry.CONST.DICE_ROLL_MODES;
		rollFormula?: string;
		primaryDieValue?: number;
		primaryDieModifier?: string;
		rollHidden?: boolean;
	}

	export interface DialogData {
		rollMode: number | undefined;
		rollFormula?: string;
		primaryDieValue?: number;
		primaryDieModifier?: string;
		upcast?: {
			manaToSpend: number;
			choiceIndex?: number;
		};
		rollHidden?: boolean;
	}
}

export { ItemActivationManager };
