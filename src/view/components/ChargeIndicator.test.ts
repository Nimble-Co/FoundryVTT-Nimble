import { render, screen } from '@testing-library/svelte';
import { beforeAll, describe, expect, it } from 'vitest';

import type { NimbleCharacter } from '../../documents/actor/character.js';
import ChargeIndicator from './ChargeIndicator.svelte';

type MockRule = {
	type: string;
	identifier?: string;
	label?: string;
	max?: string;
	initial?: string;
	hidden?: boolean;
	poolIdentifier?: string;
	cost?: string;
};

type MockItemSource = {
	id: string;
	name: string;
	rules?: MockRule[];
	pools?: Record<string, { current: number; max: number }>;
};

function createActor(items: MockItemSource[]): NimbleCharacter {
	const contents = items.map((source) => ({
		id: source.id,
		name: source.name,
		rules: new Map((source.rules ?? []).map((rule, index) => [String(index), rule])),
		flags: { nimble: { chargePools: source.pools ?? {} } },
	}));

	const actor = {
		id: 'actor-1',
		type: 'character',
		name: 'Hero',
		flags: { nimble: { chargePools: {} } },
		items: {
			contents,
			get: (id: string) => contents.find((item) => item.id === id),
		},
		getRollData: () => ({}),
	} as Record<string, unknown>;

	// The document exposes itself through `reactive` after registering the
	// Svelte subscriber; the component reads pools through that getter.
	actor.reactive = actor;

	return actor as unknown as NimbleCharacter;
}

function poolFixture(overrides: Partial<{ hidden: boolean; label: string }> = {}): MockItemSource {
	return {
		id: 'item-1',
		name: 'Focus',
		rules: [
			{
				type: 'chargePool',
				identifier: 'focus',
				label: overrides.label ?? 'Focus Charges',
				max: '3',
				initial: 'max',
				hidden: overrides.hidden ?? false,
			},
		],
		pools: { focus: { current: 2, max: 3 } },
	};
}

describe('ChargeIndicator', () => {
	beforeAll(() => {
		// The tooltip markup escapes every interpolated value; the shared Foundry
		// mock has no escapeHTML, so stand one in for this suite only.
		(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
			value: string,
		) => value;
	});

	it('renders the supplied pools without resolving its own', () => {
		const actor = createActor([poolFixture()]);

		render(ChargeIndicator, {
			actor,
			itemId: 'item-1',
			pools: [
				{
					id: 'batched',
					label: 'Batched Pool',
					current: 1,
					max: 4,
					sourceItemId: 'item-1',
					sourceItemName: 'Focus',
					recoveries: [],
				},
			],
		});

		expect(screen.getByText('1/4')).toBeInTheDocument();
		expect(screen.queryByText('2/3')).not.toBeInTheDocument();
	});

	it('resolves the item pools itself when none are supplied', () => {
		const actor = createActor([poolFixture()]);

		render(ChargeIndicator, { actor, itemId: 'item-1' });

		expect(screen.getByText('2/3')).toBeInTheDocument();
	});

	it('resolves pools the item spends from as well as the pools it declares', () => {
		const actor = createActor([
			poolFixture(),
			{
				id: 'item-2',
				name: 'Spender',
				rules: [{ type: 'chargeConsumer', poolIdentifier: 'focus', cost: '1' }],
			},
		]);

		render(ChargeIndicator, { actor, itemId: 'item-2' });

		expect(screen.getByText('2/3')).toBeInTheDocument();
	});

	it('renders nothing for an item with no pools', () => {
		const actor = createActor([{ id: 'item-1', name: 'Plain Feature' }]);

		const { container } = render(ChargeIndicator, { actor, itemId: 'item-1' });

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});

	it('renders nothing when the supplied pool list is empty', () => {
		const actor = createActor([poolFixture()]);

		const { container } = render(ChargeIndicator, { actor, itemId: 'item-1', pools: [] });

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});

	it('leaves hidden pools out of the badge it resolves for itself', () => {
		const actor = createActor([poolFixture({ hidden: true })]);

		const { container } = render(ChargeIndicator, { actor, itemId: 'item-1' });

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});
});
