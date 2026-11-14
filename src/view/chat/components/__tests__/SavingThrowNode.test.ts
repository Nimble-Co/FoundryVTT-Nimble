import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import ItemCardEffectsTestHarness from './ItemCardEffects.testHarness.svelte';

const saveNode = {
	id: 'save1',
	type: 'savingThrow',
	saveType: 'will',
	saveDC: 15,
	parentNode: null,
	parentContext: null,
	on: {},
};

describe('SavingThrowNode', () => {
	const g = globalThis as unknown as { canvas?: unknown; game: { user: unknown } };
	let saved: { canvas: unknown; user: unknown };

	beforeEach(() => {
		saved = { canvas: g.canvas, user: g.game.user };
		g.game.user = { id: 'gm', isGM: true };
		vi.stubGlobal('Roll', {
			replaceFormulaData: (formula: string) => formula,
			safeEval: (formula: string) => Number(formula),
		});
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === 'Actor.hulk.Item.pheromones'
					? { name: 'Confounding Pheromones.', system: {} }
					: null,
			),
		);
	});

	afterEach(() => {
		g.canvas = saved.canvas;
		g.game.user = saved.user;
		vi.unstubAllGlobals();
	});

	it('rolls the save with the tags of the item and the step that asked for it', async () => {
		const hero = { rollSavingThrowToChat: vi.fn() };
		g.canvas = { tokens: { controlled: [{ document: { actor: hero } }] } };
		const card = {
			id: 'card1',
			flags: { [SYSTEM_ID]: { itemUuid: 'Actor.hulk.Item.pheromones' } },
			effectNodes: [[saveNode]],
			system: { activation: { effects: [saveNode] } },
		};
		render(ItemCardEffectsTestHarness, {
			props: { messageDocument: card, effects: [saveNode] },
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));

		expect(hero.rollSavingThrowToChat).toHaveBeenCalledWith('will', {
			dc: 15,
			rollTags: ['save:from', 'save:from:confounding-pheromones'],
			cardFlags: { askedBy: { cardId: 'card1', nodeId: 'save1' } },
		});
	});
});
