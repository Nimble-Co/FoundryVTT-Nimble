import { describe, expect, it } from 'vitest';
import { resolveMinionAttackSkipReason } from './combatCommon.js';
import type { ActorWithActivateItem, ItemLike } from './combatTypes.js';

function createActor(): ActorWithActivateItem {
	return { type: 'minion', name: 'Test Minion' };
}

function createAction(cost?: { type?: string; quantity?: number }): ItemLike {
	return {
		id: 'action-1',
		name: 'Test Action',
		system: { activation: cost ? { cost } : {} },
	};
}

describe('resolveMinionAttackSkipReason', () => {
	it('skips a member with no actions remaining when the cost type is none', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 0,
				actor: createActor(),
				selectedAction: createAction({ type: 'none', quantity: 1 }),
			}),
		).toBe('noActionsRemaining');
	});

	it('skips a member with no actions remaining when the cost is missing', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 0,
				actor: createActor(),
				selectedAction: createAction(),
			}),
		).toBe('noActionsRemaining');
	});

	it('does not skip a member at zero actions when the action cost is explicitly zero', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 0,
				actor: createActor(),
				selectedAction: createAction({ type: 'action', quantity: 0 }),
			}),
		).toBeNull();
	});

	it('skips a member with no actions remaining for a standard one-action cost', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 0,
				actor: createActor(),
				selectedAction: createAction({ type: 'action', quantity: 1 }),
			}),
		).toBe('noActionsRemaining');
	});

	it('does not skip a member with one action remaining for a one-action cost', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 1,
				actor: createActor(),
				selectedAction: createAction({ type: 'action', quantity: 1 }),
			}),
		).toBeNull();
	});

	it('skips a member whose remaining actions cannot cover a multi-action cost', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 1,
				actor: createActor(),
				selectedAction: createAction({ type: 'action', quantity: 2 }),
			}),
		).toBe('noActionsRemaining');
	});

	it('reports noActionSelected when the selected action id is empty', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: '',
				currentActions: 2,
				actor: createActor(),
				selectedAction: null,
			}),
		).toBe('noActionSelected');
	});

	it('reports actorCannotActivate when the actor is missing', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 2,
				actor: null,
				selectedAction: createAction({ type: 'action', quantity: 1 }),
			}),
		).toBe('actorCannotActivate');
	});

	it('reports actionNotFound when the selected action cannot be resolved', () => {
		expect(
			resolveMinionAttackSkipReason({
				selectedActionId: 'action-1',
				currentActions: 2,
				actor: createActor(),
				selectedAction: null,
			}),
		).toBe('actionNotFound');
	});
});
