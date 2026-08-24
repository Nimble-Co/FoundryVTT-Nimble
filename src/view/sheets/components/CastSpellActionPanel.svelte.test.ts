import { render, screen } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { createSpellPanelState } from './CastSpellActionPanel.svelte.js';
import CastSpellActionPanelTestHarness from './CastSpellActionPanel.testHarness.svelte';

function createSpellFixture(cost: { type: string; quantity?: number; isReaction?: boolean }): Item {
	return {
		system: {
			activation: { cost },
		},
	} as unknown as Item;
}

function createPanelState() {
	return createSpellPanelState(
		() => ({ reactive: { items: [] } }) as unknown as NimbleCharacter,
		() => async () => {},
	);
}

describe('createSpellPanelState', () => {
	describe('getSpellMetadata', () => {
		it('shows the localized Free label for an explicit zero action cost', () => {
			const state = createPanelState();

			expect(state.getSpellMetadata(createSpellFixture({ type: 'action', quantity: 0 }))).toBe(
				'Free',
			);
		});

		it('defaults a missing action cost quantity to a single action', () => {
			const state = createPanelState();

			expect(state.getSpellMetadata(createSpellFixture({ type: 'action' }))).toBe('1 Action');
		});

		it('pluralizes multi-action costs', () => {
			const state = createPanelState();

			expect(state.getSpellMetadata(createSpellFixture({ type: 'action', quantity: 2 }))).toBe(
				'2 Actions',
			);
		});

		it('names a reaction instead of counting its actions', () => {
			const state = createPanelState();

			expect(
				state.getSpellMetadata(
					createSpellFixture({ type: 'action', quantity: 1, isReaction: true }),
				),
			).toBe('Reaction');
			expect(
				state.getSpellMetadata(
					createSpellFixture({ type: 'action', quantity: 2, isReaction: true }),
				),
			).toBe('Reaction (2 Actions)');
		});

		it('labels the legacy reaction cost type instead of rendering undefined', () => {
			const state = createPanelState();

			expect(state.getSpellMetadata(createSpellFixture({ type: 'reaction', quantity: 1 }))).toBe(
				'Reaction',
			);
		});
	});

	describe('getSpellManaCost', () => {
		it('costs a tiered spell its tier in mana', () => {
			const state = createPanelState();

			expect(state.getSpellManaCost({ system: { tier: 3 } } as unknown as Item)).toBe(3);
		});

		it('costs nothing for a cantrip', () => {
			const state = createPanelState();

			expect(state.getSpellManaCost({ system: { tier: 0 } } as unknown as Item)).toBe(0);
		});
	});
});

function createSpellItem(options: {
	id: string;
	name: string;
	chargePool?: { identifier: string; current: number; max: number };
}) {
	const pool = options.chargePool;
	const item = {
		_id: options.id,
		id: options.id,
		name: options.name,
		type: 'spell',
		sort: 0,
		rules: new Map(
			pool
				? [
						[
							'0',
							{
								type: 'chargePool',
								identifier: pool.identifier,
								max: String(pool.max),
								initial: 'max',
							},
						],
					]
				: [],
		),
		flags: {
			nimble: {
				chargePools: pool ? { [pool.identifier]: { current: pool.current, max: pool.max } } : {},
			},
		},
		system: {
			tier: 1,
			manaCost: 0,
			properties: { selected: [] },
			activation: { cost: { type: 'action', quantity: 1 } },
			description: {},
		},
	} as Record<string, unknown>;

	item.reactive = item;

	return item;
}

function createSpellActor(items: ReturnType<typeof createSpellItem>[]) {
	// The panel reads `items` as a list while the charge helpers read it as an
	// embedded collection, so the fixture answers to both shapes.
	const itemCollection = Object.assign(items, {
		contents: items,
		get: (id: string) => items.find((item) => item.id === id),
	});

	const actor = {
		id: 'spell-panel-actor',
		type: 'character',
		flags: { nimble: { chargePools: {} } },
		items: itemCollection,
		getRollData: () => ({}),
	} as Record<string, unknown>;

	actor.reactive = actor;

	return actor;
}

describe('CastSpellActionPanel charge indicators', () => {
	beforeAll(() => {
		// The badge tooltip escapes every interpolated value; the shared Foundry
		// mock has no escapeHTML, so stand one in for this suite only.
		(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
			value: string,
		) => value;
	});

	it('shows the remaining charges on a spell that has a pool', () => {
		const actor = createSpellActor([
			createSpellItem({
				id: 'spell-1',
				name: 'Firebolt',
				chargePool: { identifier: 'firebolt-uses', current: 1, max: 2 },
			}),
		]);

		render(CastSpellActionPanelTestHarness, { actor, application: { _onDragStart: vi.fn() } });

		expect(screen.getByText('1/2')).toBeInTheDocument();
	});

	it('leaves a spell without pools untouched', () => {
		const actor = createSpellActor([createSpellItem({ id: 'spell-1', name: 'Firebolt' })]);

		const { container } = render(CastSpellActionPanelTestHarness, {
			actor,
			application: { _onDragStart: vi.fn() },
		});

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});
});
