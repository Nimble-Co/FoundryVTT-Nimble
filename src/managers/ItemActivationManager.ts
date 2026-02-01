import type { EffectNode } from '#types/effectTree.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { keyPressStore } from '../stores/keyPressStore.js';
import getRollFormula from '../utils/getRollFormula.js';
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

class ItemActivationManager {
	#item: NimbleBaseItem;

	#options: ItemActivationManager.ActivationOptions;

	activationData: any;

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
			dialogData = { rollMode: options.rollMode ?? 0 };
		} else {
			// Check if there are damage or healing effects that require rolling
			const effects = this.activationData?.effects ?? [];
			const hasRolls = flattenEffectsTree(effects).some(
				(node) => node.type === 'damage' || node.type === 'healing',
			);

			if (hasRolls) {
				// Check if Alt is pressed to skip dialog
				let altPressed = false;
				const unsubscribe = keyPressStore.subscribe((state) => {
					altPressed = state.alt;
				});

				if (altPressed) {
					// Skip dialog, use default
					dialogData = this.#getDefaultDialogData(rollOptions);
				} else {
					const dialog = new ItemActivationConfigDialog(
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

		// Get Targets
		const _targets = game.user?.targets.map((t) => t.document.uuid) ?? new Set<string>();

		let rolls: (Roll | DamageRoll)[] = [];
		rolls = await this.#getRolls(dialogData);

		// Get template data
		const _templateData = this.#getTemplateData();

		return { rolls, activation: this.activationData };
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
					const resolvedCanMiss = isMinion ? true : (canMiss ?? true);
					node.rollMode = dialogData.rollMode ?? 0;

					// Use modified formula if provided
					const formula = dialogData.rollFormula || node.formula;

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
	}

	export interface DialogData {
		rollMode: number | undefined;
		rollFormula?: string;
		primaryDieValue?: number;
		primaryDieModifier?: string;
	}
}

export { ItemActivationManager };
