import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';

interface AutomaticConditionContext {
	automaticConditionSource?: string; // Track source of automatic conditions
	automaticConditionsToApply?: string[]; // Internal: conditions to apply after creation
	automaticConditionsToRemove?: string[]; // Internal: conditions to remove after deletion
	automaticConditionsActor?: NimbleBaseActor; // Actor reference for postDelete operations
}

export const handleAutomaticConditionApplication = {
	/**
	 * Before creating an ActiveEffect, check if it should trigger automatic conditions
	 */
	preCreate: async (
		document: ActiveEffect,
		data: any,
		options: AutomaticConditionContext,
		userId: string,
	) => {
		if (!document.parent || document.parent.documentName !== 'Actor') return;

		try {
			const actor = document.parent as NimbleBaseActor;
			const conditionIds = Array.from(document.statuses);

			// Check what conditions should be automatically applied
			const triggeredConditions =
				(game as any).nimble?.conditions?.getTriggeredConditions?.(conditionIds, actor) || [];

			if (triggeredConditions.length > 0) {
				// Mark this operation to prevent loops
				options.automaticConditionsToApply = triggeredConditions;
			}
		} catch (error) {
			console.warn('Error in automatic condition preCreate:', error);
		}
	},

	/**
	 * After creating an ActiveEffect, apply any automatic conditions
	 */
	postCreate: async (
		document: ActiveEffect,
		options: AutomaticConditionContext,
		userId: string,
	) => {
		if (!options.automaticConditionsToApply) return;

		try {
			const actor = document.parent as NimbleBaseActor;

			// Apply the automatic conditions
			for (const conditionId of options.automaticConditionsToApply) {
				await actor.toggleStatusEffect(conditionId, {
					overlay: false,
					automaticConditionSource: document.id,
				} as any);
			}
		} catch (error) {
			console.warn('Error in automatic condition postCreate:', error);
		}
	},

	/**
	 * Before deleting an ActiveEffect, check if automatic conditions should be removed
	 */
	preDelete: async (document: ActiveEffect, options: AutomaticConditionContext, userId: string) => {
		// Note: PreDelete is kept for consistency but no longer stores data in options
	},

	/**
	 * After deleting an ActiveEffect, remove automatic conditions if needed
	 */
	postDelete: async (
		document: ActiveEffect,
		options: AutomaticConditionContext,
		userId: string,
	) => {
		try {
			const actor = document.parent as NimbleBaseActor;
			const conditionIds = Array.from(document.statuses);

			// Recalculate what automatic conditions should be removed
			const conditionsToRemove =
				(game as any).nimble?.conditions?.getConditionsToRemove?.(conditionIds, actor) || [];

			// Remove automatic conditions that are no longer needed
			for (const conditionId of conditionsToRemove) {
				if (
					(game as any).nimble?.conditions?.shouldRemoveTriggeredCondition?.(conditionId, actor)
				) {
					await actor.toggleStatusEffect(conditionId, {
						active: false,
					} as any);
				}
			}
		} catch (error) {
			console.warn('Error in automatic condition postDelete:', error);
		}
	},
};
