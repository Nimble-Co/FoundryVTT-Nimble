import { beforeEach, describe, expect, it, vi } from 'vitest';
import prepareActorConditions from './prepareActorConditions.js';

describe('prepareActorConditions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('sorts conditions alphabetically by display name', () => {
		const getMetadata = vi.fn((id: string) => ({
			id,
			name: id === 'zeta' ? 'Zeta' : 'Alpha',
			img: `${id}.svg`,
		}));
		(game.nimble.conditions as { get: (id: string) => unknown }).get = getMetadata;

		const actor = {
			conditionsMetadata: {
				active: new Set(['zeta', 'alpha']),
				overlay: new Set<string>(),
			},
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(result.map((c) => c.id)).toEqual(['alpha', 'zeta']);
	});

	it('marks overlay conditions and uses configured descriptions', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: id,
			img: `${id}.svg`,
		}));

		const actor = {
			conditionsMetadata: {
				active: new Set(['blinded']),
				overlay: new Set(['blinded']),
			},
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(result).toHaveLength(1);
		expect(result[0].isOverlay).toBe(true);
		expect(result[0].descriptionHtml).toBe(CONFIG.NIMBLE.conditionDescriptions.blinded);
	});

	it('handles missing metadata and empty actor gracefully', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn(() => undefined);
		(CONFIG.NIMBLE.conditionDefaultImages as Record<string, string>).customCondition =
			'fallback.svg';
		(CONFIG.NIMBLE.conditions as Record<string, string>).customCondition = 'Custom Condition';

		const actor = {
			conditionsMetadata: {
				active: new Set(['customCondition']),
				overlay: new Set<string>(),
			},
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(prepareActorConditions(null)).toEqual([]);
		expect(result).toEqual([
			{
				id: 'customCondition',
				name: 'Custom Condition',
				img: 'fallback.svg',
				descriptionHtml: '',
				active: true,
				isOverlay: false,
			},
		]);
	});
});
