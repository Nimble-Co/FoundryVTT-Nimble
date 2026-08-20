import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type { ConditionUsage } from '../../settings/findConditionUsage.js';
import RemoveConditionDialog from './RemoveConditionDialog.svelte';

function usage(overrides: Partial<ConditionUsage> = {}): ConditionUsage {
	return { actors: [], items: [], total: 0, ...overrides };
}

function renderDialog(value: ConditionUsage) {
	const dialog = { submit: vi.fn(), close: vi.fn() } as unknown as GenericDialog;
	render(RemoveConditionDialog, {
		props: { dialog, conditionName: 'Hexed', conditionImg: 'icons/svg/hex.svg', usage: value },
	});
	return dialog;
}

describe('RemoveConditionDialog', () => {
	beforeEach(() => {
		(CONFIG as unknown as { NIMBLE: Record<string, unknown> }).NIMBLE = { ruleTypes: {} };
	});

	it('names the condition and totals the effects across creatures', () => {
		renderDialog(
			usage({
				actors: [
					{
						uuid: 'Actor.Goblin',
						name: 'Goblin',
						img: '',
						effects: [
							{ effectId: 'e1', parent: {}, parentName: 'Goblin' },
							{ effectId: 'e2', parent: {}, parentName: 'Goblin' },
						],
					},
					{
						uuid: 'Actor.Bandit',
						name: 'Bandit',
						img: '',
						effects: [{ effectId: 'e3', parent: {}, parentName: 'Bandit' }],
					},
				],
				total: 2,
			}),
		);

		expect(screen.getByText('Remove "Hexed"?')).toBeVisible();
		expect(screen.getByText('On creatures')).toBeVisible();
		expect(screen.getByText('3 effect(s)')).toBeVisible();
		expect(screen.getByText('Goblin')).toBeVisible();
		expect(screen.getByText('Bandit')).toBeVisible();
	});

	it('lists each item with its owner and what references the condition', () => {
		renderDialog(
			usage({
				items: [
					{
						uuid: 'Item.HexBolt',
						name: 'Hex Bolt',
						img: '',
						ownerName: 'Wizard',
						item: {},
						referenceLabels: ['Apply Condition', 'Condition Immunity'],
						ruleIds: ['r1'],
						immunityRuleIds: ['r2'],
						markTargetRuleIds: [],
						nodeIds: [],
					},
				],
				total: 1,
			}),
		);

		expect(screen.getByText('In items')).toBeVisible();
		expect(screen.getByText('1 item(s)')).toBeVisible();
		expect(screen.getByText('Wizard')).toBeVisible();
		expect(screen.getByText('Apply Condition, Condition Immunity')).toBeVisible();
	});

	it('omits the creatures section when only items reference the condition', () => {
		renderDialog(
			usage({
				items: [
					{
						uuid: 'Item.HexBolt',
						name: 'Hex Bolt',
						img: '',
						ownerName: null,
						item: {},
						referenceLabels: ['Apply Condition'],
						ruleIds: ['r1'],
						immunityRuleIds: [],
						markTargetRuleIds: [],
						nodeIds: [],
					},
				],
				total: 1,
			}),
		);

		expect(screen.queryByText('On creatures')).toBeNull();
		expect(screen.getByText('In items')).toBeVisible();
	});

	it('reports the choice, and treats closing as neither', async () => {
		const dialog = renderDialog(usage());

		await fireEvent.click(screen.getByRole('button', { name: 'Remove Only' }));
		expect(dialog.submit).toHaveBeenCalledWith({ choice: 'keep' });

		await fireEvent.click(screen.getByRole('button', { name: /Remove Everywhere/ }));
		expect(dialog.submit).toHaveBeenCalledWith({ choice: 'clean' });

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(dialog.close).toHaveBeenCalled();
		expect(dialog.submit).toHaveBeenCalledTimes(2);
	});

	it('says the removal is deferred, since the editor applies it on save', () => {
		renderDialog(usage());

		expect(screen.getByText('Nothing changes until you save the conditions list.')).toBeVisible();
	});
});
