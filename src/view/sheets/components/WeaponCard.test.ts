import { render, screen } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { NimbleCharacter } from '../../../documents/actor/character.js';
import WeaponCard from './WeaponCard.svelte';

function createActor(pool: { identifier: string; current: number; max: number } | null) {
	const items = [
		{
			id: 'item-1',
			name: 'Rally',
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
		},
	];

	const actor = {
		id: 'attack-panel-actor',
		type: 'character',
		flags: { nimble: { chargePools: {} } },
		items: Object.assign(items, {
			contents: items,
			get: (id: string) => items.find((item) => item.id === id),
		}),
		getRollData: () => ({}),
	} as Record<string, unknown>;

	actor.reactive = actor;

	return actor as unknown as NimbleCharacter;
}

describe('WeaponCard', () => {
	beforeAll(() => {
		// The badge tooltip escapes every interpolated value; the shared Foundry
		// mock has no escapeHTML, so stand one in for this suite only.
		(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
			value: string,
		) => value;
	});

	it('shows the remaining charges for an item with a pool', () => {
		render(WeaponCard, {
			name: 'Rally',
			actor: createActor({ identifier: 'rally-uses', current: 1, max: 3 }),
			itemId: 'item-1',
			onclick: vi.fn(),
		});

		expect(screen.getByText('1/3')).toBeInTheDocument();
	});

	it('renders no charge badge for an item without pools', () => {
		const { container } = render(WeaponCard, {
			name: 'Longsword',
			actor: createActor(null),
			itemId: 'item-1',
			onclick: vi.fn(),
		});

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});

	it('renders no charge badge for a card with no item behind it', () => {
		const { container } = render(WeaponCard, {
			name: 'Unarmed Strike',
			onclick: vi.fn(),
		});

		expect(container.querySelector('.charge-indicator')).not.toBeInTheDocument();
	});

	it('keeps the card clickable when its pool is empty', async () => {
		const onclick = vi.fn();
		render(WeaponCard, {
			name: 'Rally',
			actor: createActor({ identifier: 'rally-uses', current: 0, max: 3 }),
			itemId: 'item-1',
			onclick,
		});

		expect(screen.getByText('0/3')).toBeInTheDocument();

		const row = screen.getByRole('button', { name: /rally/i });
		expect(row).not.toHaveAttribute('disabled');
		row.click();

		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
