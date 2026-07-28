import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';
import DicePoolPanelStateHarness from '../../../../tests/harnesses/DicePoolPanelStateHarness.svelte';

type ConsumerRule = {
	type: 'diceConsumer';
	id: string;
	label: string;
	poolIdentifier: string;
	poolScope: string;
	mode: string;
	cost: string;
	effectFormula: string | null;
	effectType: string;
	selectionOutcome: string;
	bonusOnAttackDelivery: null;
};

function makeConsumerRule(overrides: Partial<ConsumerRule> = {}): ConsumerRule {
	return {
		type: 'diceConsumer',
		id: 'maximize-rule',
		label: 'Blood Frenzy',
		poolIdentifier: 'fury',
		poolScope: 'item',
		mode: 'manual',
		cost: '1',
		effectFormula: null,
		effectType: 'generic',
		selectionOutcome: 'maximize',
		bonusOnAttackDelivery: null,
		...overrides,
	};
}

/**
 * A character with a single item that both defines the `fury` pool and carries the
 * consumers under test. Item `update` writes straight back into the fixture's flags so
 * the pool reflects a persisted change the way it would in a world.
 */
function createActor(faces: number[], consumerRules: ConsumerRule[]) {
	const item = {
		id: 'item-rage',
		name: 'Rage',
		img: 'icons/rage.webp',
		system: { description: 'Rage description' },
		flags: {
			[SYSTEM_ID]: {
				dicePools: {
					fury: {
						identifier: 'fury',
						label: 'Fury Dice',
						dieSize: 'd6',
						max: 4,
						faces: [...faces],
					},
				},
			},
		} as Record<string, unknown>,
		rules: new Map<string, unknown>([
			[
				'fury-pool',
				{
					type: 'dicePool',
					id: 'fury-pool',
					identifier: 'fury',
					label: 'Fury Dice',
					scope: 'item',
					dieSize: 'd6',
					max: '4',
					refills: [],
				},
			],
			...consumerRules.map((rule) => [rule.id, rule] as [string, unknown]),
		]),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(item, path, value);
			}
			return item;
		}),
	};

	return {
		type: 'character',
		items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
		getRollData: () => ({}),
		update: vi.fn(async () => undefined),
		item,
	};
}

function poolView() {
	return {
		kind: 'rolled' as const,
		id: 'fury',
		identifier: 'fury',
		label: 'Fury Dice',
		dieSize: 'd6',
		max: 4,
		faces: [] as number[],
		total: 0,
		hasConsumers: true,
	};
}

type Snapshot = {
	selected: number[];
	selectedCount: number;
	selectedSum: number;
	isMaximizeOutcome: boolean;
	selectable: boolean[];
};

async function mount(actor: ReturnType<typeof createActor>) {
	const screen = render(DicePoolPanelStateHarness, {
		props: { actor, pool: poolView() },
	});
	const read = async (): Promise<Snapshot> => {
		let parsed!: Snapshot;
		await waitFor(() => {
			parsed = JSON.parse(screen.getByTestId('snapshot').textContent ?? '{}');
			expect(parsed.selectable).toBeDefined();
		});
		return parsed;
	};
	return { ...screen, read };
}

function persistedFaces(actor: ReturnType<typeof createActor>): number[] {
	const pools = foundry.utils.getProperty(actor.item, `flags.${SYSTEM_ID}.dicePools`) as Record<
		string,
		{ faces: number[] }
	>;
	return pools.fury.faces;
}

describe('createDicePoolPanelState selection outcomes', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(globalThis as unknown as { ChatMessage: unknown }).ChatMessage = {
			create: vi.fn(async () => ({})),
			getSpeaker: vi.fn(() => ({})),
		};
		(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
			value: string,
		) => value;
		// The spend path posts its own roll; the shared Roll mock has no chat plumbing.
		(
			globalThis as unknown as { Roll: { prototype: Record<string, unknown> } }
		).Roll.prototype.toMessage = vi.fn(async () => ({}));
	});

	it('leaves the selection uncapped for a spending consumer', async () => {
		const actor = createActor(
			[2, 6, 3],
			[makeConsumerRule({ selectionOutcome: 'consume', effectFormula: '@sum' })],
		);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('die-1'));
		await fireEvent.click(getByTestId('die-2'));

		const snapshot = await read();
		expect(snapshot.isMaximizeOutcome).toBe(false);
		expect(snapshot.selected).toEqual([0, 1, 2]);
		expect(snapshot.selectedSum).toBe(11);
	});

	it('caps a transforming consumer with cost 1 to one die, swapping the pick', async () => {
		const actor = createActor([2, 6, 3], [makeConsumerRule()]);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		expect((await read()).selected).toEqual([0]);

		// A second pick evicts the first rather than dead-ending the player.
		await fireEvent.click(getByTestId('die-2'));
		const snapshot = await read();
		expect(snapshot.isMaximizeOutcome).toBe(true);
		expect(snapshot.selected).toEqual([2]);
	});

	it('caps a transforming consumer at a cost above 1', async () => {
		const actor = createActor([2, 3, 4, 5], [makeConsumerRule({ cost: '2' })]);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('die-1'));
		await fireEvent.click(getByTestId('die-2'));

		const snapshot = await read();
		expect(snapshot.selected).toHaveLength(2);
		// The newest pick is kept; the oldest made way for it.
		expect(snapshot.selected).toContain(2);
		expect(snapshot.selected).not.toContain(0);
	});

	it('trims an over-cap selection when switching to a capped consumer', async () => {
		const actor = createActor(
			[2, 6, 3],
			[
				makeConsumerRule({
					id: 'spend-rule',
					selectionOutcome: 'consume',
					effectFormula: '@sum',
				}),
				makeConsumerRule({ id: 'maximize-rule' }),
			],
		);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-spend-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('die-2'));
		expect((await read()).selected).toEqual([0, 2]);

		await fireEvent.click(getByTestId('consumer-spend-rule'));
		await fireEvent.click(getByTestId('consumer-maximize-rule'));

		expect((await read()).selected).toHaveLength(1);
	});

	it('does not offer dice already at their maximum face to a transforming consumer', async () => {
		const actor = createActor([2, 6, 3], [makeConsumerRule()]);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		// Faces are [2, 6, 3] on a d6: only the 6 cannot be raised.
		expect((await read()).selectable).toEqual([true, false, true]);

		await fireEvent.click(getByTestId('die-1'));
		expect((await read()).selected).toEqual([]);
	});

	it('offers every die to a spending consumer regardless of face', async () => {
		const actor = createActor(
			[2, 6, 3],
			[makeConsumerRule({ selectionOutcome: 'consume', effectFormula: '@sum' })],
		);
		const { getByTestId, read } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		expect((await read()).selectable).toEqual([true, true, true]);
	});

	it('raises only the picked die and leaves the rest of the pool alone', async () => {
		const actor = createActor([2, 6, 3], [makeConsumerRule()]);
		const { getByTestId } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-2'));
		await fireEvent.click(getByTestId('spend'));

		await waitFor(() => {
			expect(persistedFaces(actor)).toEqual([2, 6, 6]);
		});
	});

	it('raises every picked die when the cost allows more than one', async () => {
		const actor = createActor([2, 3, 4, 5], [makeConsumerRule({ cost: '2' })]);
		const { getByTestId } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('die-3'));
		await fireEvent.click(getByTestId('spend'));

		await waitFor(() => {
			expect(persistedFaces(actor)).toEqual([6, 3, 4, 6]);
		});
	});

	it('reports the raise to chat with the face it changed', async () => {
		const actor = createActor([2, 6, 3], [makeConsumerRule()]);
		const { getByTestId } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('spend'));

		const chat = (globalThis as unknown as { ChatMessage: { create: ReturnType<typeof vi.fn> } })
			.ChatMessage;
		await waitFor(() => {
			expect(chat.create).toHaveBeenCalledTimes(1);
		});
		expect(String(chat.create.mock.calls[0][0].content)).toContain('2 → 6');
	});

	it('spends the picked dice for a consuming consumer instead of raising them', async () => {
		const actor = createActor(
			[2, 6, 3],
			[makeConsumerRule({ selectionOutcome: 'consume', effectFormula: '@sum' })],
		);
		const { getByTestId } = await mount(actor);

		await fireEvent.click(getByTestId('consumer-maximize-rule'));
		await fireEvent.click(getByTestId('die-0'));
		await fireEvent.click(getByTestId('spend'));

		await waitFor(() => {
			expect(persistedFaces(actor)).toEqual([6, 3]);
		});
	});
});
