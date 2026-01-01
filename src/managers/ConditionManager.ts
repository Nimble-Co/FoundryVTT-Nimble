import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import localize from '../utils/localize.js';

export interface ConditionTriggerConfig {
	triggeredBy: readonly string[];
	priority: number;
	stackable: boolean;
	autoRemove: boolean;
}

export interface Condition {
	_id?: string;
	id: string;
	name: string;
	img: string;
	aliases?: Set<string> | undefined;
	statuses?: string[] | undefined;
	stackable: boolean;
	enriched: string;
}

export class ConditionManager {
	#conditions: Map<string, Condition>;

	#ready: boolean;

	constructor() {
		this.#conditions = new Map();
		this.#ready = false;
	}

	initialize() {
		const conditions = Object.keys(CONFIG.NIMBLE.conditions);

		conditions.forEach(async (c) => {
			let _id: string | null = null;

			const id = c;
			const name = CONFIG.NIMBLE.conditions[id];
			const img = CONFIG.NIMBLE.conditionDefaultImages[id];
			const aliases: string[] = CONFIG.NIMBLE.conditionAliasedConditions[id] ?? [];
			const statuses: string[] = CONFIG.NIMBLE.conditionLinkedConditions[id] ?? [];
			const stackable = CONFIG.NIMBLE.conditionStackableConditions.has(id);

			const data = {
				id,
				name,
				img,
				stackable,
			} as Condition;

			if (aliases.length) data.aliases = new Set(aliases);

			if (statuses.length) {
				data.statuses = statuses;

				_id = String(id).padEnd(16, '0');
				data._id = _id;
			}

			// Add an enriched version of the condition to the data
			try {
				data.enriched =
					(await foundry.applications.ux?.TextEditor?.implementation?.enrichHTML?.(
						`[[/condition condition=${id}]]`,
					)) || `[[/condition condition=${id}]]`;
			} catch (_error) {
				data.enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
					`[[/condition condition=${id}]]`,
				);
			}

			this.#conditions.set(id, data);
		});

		this.#ready = true;
	}

	configureStatusEffects() {
		if (!this.#ready) throw Error('Conditions are not ready yet.');

		const statusEffects = [...this.#conditions.values()];

		CONFIG.statusEffects = statusEffects.sort((a, b) => {
			const aid = a.name !== undefined ? localize(a.name) : a.id || a;
			const bid = b.name !== undefined ? localize(b.name) : b.id || b;

			return aid > bid ? 1 : aid < bid ? -1 : 0;
		});
	}

	get(conditionId: string) {
		return this.#conditions.get(conditionId);
	}

	getMetadata(actor: NimbleBaseActor) {
		const { effects } = actor;

		const activeConditions = new Set<string>();
		const overlayConditions = new Set<string>();

		effects.forEach((effect) => {
			effect.statuses.forEach((statusId) => {
				const status = this.#conditions.get(statusId);
				if (!status) return;

				if (status._id) {
					if (status._id !== effect.id) return;
				} else if (effect.statuses.size !== 1) return;

				activeConditions.add(statusId);

				if (
					(effect as object as { getFlag(scope: string, key: string): unknown }).getFlag(
						'core',
						'overlay',
					)
				)
					overlayConditions.add(statusId);
			});
		});

		return {
			active: activeConditions,
			overlay: overlayConditions,
		};
	}

	getTagGroupData() {
		return [...this.#conditions.values()].map((condition) => {
			return { label: condition.name, value: condition.id };
		});
	}

	/**
	 * Get conditions that should be automatically triggered when the given conditions are applied
	 * @param appliedConditionIds - Array of condition IDs being applied
	 * @param actor - The actor the conditions are being applied to
	 * @returns Array of condition IDs that should be automatically applied
	 */
	getTriggeredConditions(appliedConditionIds: string[], actor: NimbleBaseActor): string[] {
		const { conditionTriggerRelationships = {} } = CONFIG.NIMBLE;
		const triggeredConditions: string[] = [];

		// Check each potential target condition (like hampered)
		for (const [targetCondition, config] of Object.entries(conditionTriggerRelationships)) {
			const typedConfig = config as ConditionTriggerConfig;

			// Skip if target condition already exists and isn't stackable
			if (!typedConfig.stackable && actor.statuses.has(targetCondition)) continue;

			// Check if any applied conditions trigger this target condition
			const hasTriggeredCondition = appliedConditionIds.some((conditionId) =>
				typedConfig.triggeredBy.includes(conditionId),
			);

			if (hasTriggeredCondition) {
				triggeredConditions.push(targetCondition);
			}
		}

		return triggeredConditions.sort((a, b) => {
			const configA = conditionTriggerRelationships[a] as ConditionTriggerConfig;
			const configB = conditionTriggerRelationships[b] as ConditionTriggerConfig;
			return (configA?.priority ?? 999) - (configB?.priority ?? 999);
		});
	}

	/**
	 * Get automatic conditions that should be removed when the given conditions are removed
	 * @param removedConditionIds - Array of condition IDs being removed
	 * @param actor - The actor the conditions are being removed from
	 * @returns Array of condition IDs that should be automatically removed
	 */
	getConditionsToRemove(removedConditionIds: string[], actor: NimbleBaseActor): string[] {
		const { conditionTriggerRelationships = {} } = CONFIG.NIMBLE;
		const conditionsToRemove: string[] = [];

		// Check each automatic condition that might need removal
		for (const [targetCondition, config] of Object.entries(conditionTriggerRelationships)) {
			const typedConfig = config as ConditionTriggerConfig;

			if (!typedConfig.autoRemove) continue;
			if (!actor.statuses.has(targetCondition)) continue;

			// Check if any removed conditions were triggers for this target condition
			const removedATrigger = removedConditionIds.some((conditionId) =>
				typedConfig.triggeredBy.includes(conditionId),
			);

			if (removedATrigger) {
				conditionsToRemove.push(targetCondition);
			}
		}

		return conditionsToRemove;
	}

	/**
	 * Check if an automatically applied condition should be removed
	 * @param conditionId - The condition ID to check
	 * @param actor - The actor to check
	 * @returns True if the condition should be removed, false otherwise
	 */
	shouldRemoveTriggeredCondition(conditionId: string, actor: NimbleBaseActor): boolean {
		const { conditionTriggerRelationships = {} } = CONFIG.NIMBLE;
		const config = conditionTriggerRelationships[conditionId] as ConditionTriggerConfig;

		if (!config || !config.autoRemove) return false;

		// Check if any trigger conditions still exist
		const stillHasTrigger = config.triggeredBy.some((triggerConditionId) =>
			actor.statuses.has(triggerConditionId as string),
		);

		return !stillHasTrigger;
	}
}
