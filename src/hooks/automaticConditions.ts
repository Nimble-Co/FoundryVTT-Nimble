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
		_data: ActiveEffect.CreateData,
		options: ActiveEffect.Database.PreCreateOptions & AutomaticConditionContext,
		_userId: string,
	): Promise<boolean | undefined> => {
		if (!document.parent || document.parent.documentName !== 'Actor') return;

		try {
			const actor = document.parent as NimbleBaseActor;
			const conditionIds = Array.from(document.statuses);

			// Check what conditions should be automatically applied
			const triggeredConditions =
				game.nimble?.conditions?.getTriggeredConditions?.(conditionIds, actor) || [];

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
		options: ActiveEffect.Database.CreateOptions & AutomaticConditionContext,
		_userId: string,
	): Promise<void> => {
		if (!options.automaticConditionsToApply) return;

		try {
			const actor = document.parent as NimbleBaseActor;

			// Apply the automatic conditions
			for (const conditionId of options.automaticConditionsToApply) {
				await actor.toggleStatusEffect(conditionId, {
					overlay: false,
					automaticConditionSource: document.id,
				} as object as { overlay: boolean });
			}
		} catch (error) {
			console.warn('Error in automatic condition postCreate:', error);
		}
	},

	/**
	 * Before deleting an ActiveEffect, check if automatic conditions should be removed
	 */
	preDelete: async (
		_document: ActiveEffect,
		_options: ActiveEffect.Database.PreDeleteOptions & AutomaticConditionContext,
		_userId: string,
	): Promise<boolean | undefined> => {
		// Note: PreDelete is kept for consistency but no longer stores data in options
		return undefined;
	},

	/**
	 * After deleting an ActiveEffect, remove automatic conditions if needed
	 */
	postDelete: async (
		document: ActiveEffect,
		_options: ActiveEffect.Database.DeleteOptions & AutomaticConditionContext,
		_userId: string,
	): Promise<void> => {
		try {
			const actor = document.parent as NimbleBaseActor;
			const conditionIds = Array.from(document.statuses);

			// Recalculate what automatic conditions should be removed
			const conditionsToRemove =
				game.nimble?.conditions?.getConditionsToRemove?.(conditionIds, actor) || [];

			// Remove automatic conditions that are no longer needed
			for (const conditionId of conditionsToRemove) {
				if (game.nimble?.conditions?.shouldRemoveTriggeredCondition?.(conditionId, actor)) {
					await actor.toggleStatusEffect(conditionId, {
						active: false,
					});
				}
			}
		} catch (error) {
			console.warn('Error in automatic condition postDelete:', error);
		}
	},
};
