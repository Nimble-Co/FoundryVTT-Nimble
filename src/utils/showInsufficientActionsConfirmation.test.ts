import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import showInsufficientActionsConfirmation from './showInsufficientActionsConfirmation.js';

function confirmDialog() {
	return foundry.applications.api.DialogV2.confirm as unknown as Mock;
}

describe('showInsufficientActionsConfirmation', () => {
	beforeEach(() => {
		confirmDialog().mockReset();
	});

	it('proceeds without prompting when the cost is affordable', async () => {
		const proceed = await showInsufficientActionsConfirmation({
			activityName: 'Test Activity',
			requiredActions: 2,
			currentActions: 2,
		});

		expect(proceed).toBe(true);
		expect(confirmDialog()).not.toHaveBeenCalled();
	});

	it('proceeds without prompting when force is set, even with insufficient actions', async () => {
		const proceed = await showInsufficientActionsConfirmation({
			activityName: 'Test Activity',
			requiredActions: 2,
			currentActions: 0,
			force: true,
		});

		expect(proceed).toBe(true);
		expect(confirmDialog()).not.toHaveBeenCalled();
	});

	it('prompts and proceeds when the player confirms the overspend', async () => {
		confirmDialog().mockResolvedValue(true);

		const proceed = await showInsufficientActionsConfirmation({
			activityName: 'Test Activity',
			requiredActions: 2,
			currentActions: 1,
		});

		expect(proceed).toBe(true);
		expect(confirmDialog()).toHaveBeenCalledTimes(1);
	});

	it('prompts and blocks when the player cancels', async () => {
		confirmDialog().mockResolvedValue(false);

		const proceed = await showInsufficientActionsConfirmation({
			activityName: 'Test Activity',
			requiredActions: 2,
			currentActions: 1,
		});

		expect(proceed).toBe(false);
		expect(confirmDialog()).toHaveBeenCalledTimes(1);
	});

	it('blocks when the dialog is dismissed without a choice', async () => {
		confirmDialog().mockResolvedValue(null);

		const proceed = await showInsufficientActionsConfirmation({
			activityName: 'Test Activity',
			requiredActions: 1,
			currentActions: 0,
		});

		expect(proceed).toBe(false);
	});
});
