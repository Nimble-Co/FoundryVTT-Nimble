import { describe, expect, it, vi } from 'vitest';

import { createSpellCardState } from './SpellReferenceCard.svelte.js';

function createSpellFixture(cost: { type?: string; quantity?: number }): Item {
	return {
		name: 'Shadow Blast',
		system: {
			tier: 1,
			description: { baseEffect: '<p>Base Effect</p>' },
			activation: {
				cost,
				targets: { count: 1 },
				acquireTargetsFromTemplate: false,
				effects: [],
			},
			properties: {
				selected: ['range'],
				range: { max: 8 },
			},
		},
	} as unknown as Item;
}

describe('createSpellCardState', () => {
	it('shows the localized Free label for an explicit zero action cost', () => {
		const state = createSpellCardState(() => createSpellFixture({ type: 'action', quantity: 0 }));

		expect(state.displayData.meta).toBe('Free');
	});

	it('defaults a missing action cost quantity to a single action', () => {
		const state = createSpellCardState(() => createSpellFixture({ type: 'action' }));

		expect(state.displayData.meta).toBe('1 Action');
	});

	it('lazily enriches a combined spell description once and opens the spell sheet on demand', async () => {
		const enrichHtml = vi
			.mocked(foundry.applications.ux.TextEditor.implementation.enrichHTML)
			.mockResolvedValue('<p>Enriched Spell Description</p>');
		const renderSheet = vi.fn();
		const spell = {
			name: 'Shadow Blast',
			sheet: {
				render: renderSheet,
			},
			system: {
				tier: 1,
				description: {
					baseEffect: '<p>Base Effect</p>',
					higherLevelEffect: '<p>Higher Level Effect</p>',
					upcastEffect: '<p>Upcast Effect</p>',
				},
				activation: {
					cost: { type: 'action', quantity: 1 },
					targets: { count: 1 },
					acquireTargetsFromTemplate: false,
					effects: [],
				},
				properties: {
					selected: ['range'],
					range: { max: 8 },
				},
			},
		} as unknown as Item;

		const state = createSpellCardState(() => spell);

		state.toggleExpanded();

		expect(state.isExpanded).toBe(true);
		await vi.waitFor(() => {
			expect(state.enrichedDescription).toBe('<p>Enriched Spell Description</p>');
		});
		expect(enrichHtml).toHaveBeenCalledTimes(1);
		expect(enrichHtml).toHaveBeenCalledWith(
			'<p>Base Effect</p><p><strong>Higher Levels:</strong> <p>Higher Level Effect</p></p><p><strong>Upcast:</strong> <p>Upcast Effect</p></p>',
		);

		state.toggleExpanded();
		state.toggleExpanded();

		await vi.waitFor(() => {
			expect(state.isExpanded).toBe(true);
		});
		expect(enrichHtml).toHaveBeenCalledTimes(1);

		state.viewDetails();
		expect(renderSheet).toHaveBeenCalledWith(true);
	});
});
