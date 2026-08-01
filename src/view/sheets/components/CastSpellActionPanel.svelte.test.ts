import { describe, expect, it } from 'vitest';

import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { createSpellPanelState } from './CastSpellActionPanel.svelte.js';

function createSpellFixture(cost: { type: string; quantity?: number }): Item {
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
	});
});
