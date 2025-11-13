import type { EffectNode } from '#types/effectTree.js';
import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import ItemActivationConfigDialog from '../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { keyPressStore } from '../stores/keyPressStore.js';
import getRollFormula from '../utils/getRollFormula.js';
import { flattenEffectsTree } from '../utils/treeManipulation/flattenEffectsTree.js';
import { reconstructEffectsTree } from '../utils/treeManipulation/reconstructEffectsTree.js';

class ItemActivationManager {
	#item: NimbleBaseItem;

	#options: ItemActivationManager.ActivationOptions;

	activationData: any;

	constructor(item: NimbleBaseItem, options: ItemActivationManager.ActivationOptions) {
		this.#item = item;
		this.#options = options;

		this.activationData = foundry.utils.deepClone(item.system.activation ?? {});
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
			dialogData = { rollMode: 0 };
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
		// @ts-expect-error
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
			if (node.type === 'savingThrow') {
				// Handle saving throw rolls
				if (!this.actor) continue;

				// Use saveType if available, otherwise fall back to savingThrowType
				const saveKey = (node as any).saveType || node.savingThrowType;
				const rollMode = dialogData.rollMode ?? 0;

				const rollFormula = getRollFormula(this.actor, {
					saveKey,
					rollMode,
					type: 'savingThrow',
				});

				const roll = new NimbleRoll(rollFormula, {
					...this.actor.getRollData(),
					prompted: false,
					respondentId: this.actor?.token?.uuid ?? this.actor.uuid,
				} as Record<string, any>);

				await roll.evaluate();
				(node as any).roll = roll.toJSON();
				rolls.push(roll);
			} else if (node.type === 'damage' || node.type === 'healing') {
				let roll: Roll | DamageRoll;

				if (node.type === 'damage' && !foundDamageRoll) {
					const { canCrit, canMiss } = node;
					node.rollMode = dialogData.rollMode ?? 0;

					// Use modified formula if provided
					const formula = dialogData.rollFormula || node.formula;

					roll = new DamageRoll(formula, this.actor.getRollData(), {
						canCrit,
						canMiss,
						rollMode: node.rollMode,
						primaryDieValue: dialogData.primaryDieValue,
						primaryDieModifier: dialogData.primaryDieModifier,
					} as any);

					foundDamageRoll = true;
				} else {
					roll = new Roll(node.formula || '0', this.actor.getRollData()) as any;
				}

				await roll.evaluate();
				node.roll = roll.toJSON();
				rolls.push(roll);
			}

			updatedEffects.push(node);
		}

		// Updating the effects tree this way ensures that the changes above are reflected in the activation data.
		this.activationData.effects = reconstructEffectsTree(updatedEffects);

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
		const { activation } = item.system ?? {};
		const { template } = activation ?? {};
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
				distance: template.radius || 1,
				t: 'circle',
			};
		}

		if (shape === 'cone') {
			return {
				...templateData,
				angle: CONFIG.MeasuredTemplate.defaults.angle,
				direction: 0,
				distance: template.length || 1,
				t: 'cone',
			};
		}

		if (shape === 'emanation') {
			const radiusFunc = (t) => {
				const radius = template.radius || 1;
				const tokenSize = Math.max(t.document.width, t.document.height);
				const scaleBy = tokenSize / 2;
				return radius + scaleBy;
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
				distance: template.length || 1,
				t: 'ray',
				width: template.width || 1,
			};
		}

		if (shape === 'square') {
			const width = template.width || 1;
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
	}
}

export { ItemActivationManager };
