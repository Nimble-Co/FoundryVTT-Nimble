import { beforeEach, describe, expect, it, vi } from 'vitest';
import prepareActorConditions from './prepareActorConditions.js';

function createEffect({
	statuses,
	duration,
	sourceName,
}: {
	statuses: string[];
	duration?: { remaining?: number; seconds?: number; rounds?: number; turns?: number };
	sourceName?: string;
}) {
	return {
		statuses: new Set(statuses),
		duration,
		sourceName,
	} as unknown as ActiveEffect;
}

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
			effects: [],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(result.map((c) => c.id)).toEqual(['alpha', 'zeta']);
	});

	it('marks overlay conditions, builds tooltip, and uses configured descriptions', () => {
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
			effects: [
				createEffect({ statuses: ['blinded'], duration: { rounds: 3 }, sourceName: 'Spell' }),
			],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(result).toHaveLength(1);
		expect(result[0].isOverlay).toBe(true);
		expect(result[0].durationLabel).toBe('3r');
		expect(result[0].sourceLabel).toBe('Spell');
		expect(result[0].descriptionHtml).toBe(CONFIG.NIMBLE.conditionDescriptions.blinded);
		expect(result[0].tooltipHtml).toContain('nimble-tooltip__enricher-heading');
		expect(result[0].tooltipHtml).toContain('Duration: 3 Rounds');
		expect(result[0].tooltipHtml).toContain('Source: Spell');
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
			effects: [],
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
				durationLabel: '∞',
				durationSortMs: null,
				sourceLabel: 'None',
				tooltipHtml: expect.stringContaining('Custom Condition'),
			},
		]);
	});

	it('uses soonest-expiring duration when multiple effects set the same condition', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: id,
			img: `${id}.svg`,
		}));

		const actor = {
			conditionsMetadata: {
				active: new Set(['blinded']),
				overlay: new Set<string>(),
			},
			effects: [
				createEffect({
					statuses: ['blinded'],
					duration: { remaining: 180 },
					sourceName: 'Long Spell',
				}),
				createEffect({
					statuses: ['blinded'],
					duration: { remaining: 45 },
					sourceName: 'Short Spell',
				}),
				createEffect({ statuses: ['blinded'] }),
			],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);

		expect(result).toHaveLength(1);
		expect(result[0].durationLabel).toBe('45s');
		expect(result[0].durationSortMs).toBe(45000);
		expect(result[0].sourceLabel).toBe('Short Spell');
	});

	it('supports compact minute and hour labels', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: id,
			img: `${id}.svg`,
		}));

		const actor = {
			conditionsMetadata: {
				active: new Set(['blinded', 'poisoned']),
				overlay: new Set<string>(),
			},
			effects: [
				createEffect({ statuses: ['blinded'], duration: { remaining: 600 }, sourceName: 'Clock' }),
				createEffect({ statuses: ['poisoned'], duration: { remaining: 5400 }, sourceName: 'Aura' }),
			],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor);
		const blinded = result.find((condition) => condition.id === 'blinded');
		const poisoned = result.find((condition) => condition.id === 'poisoned');

		expect(blinded?.durationLabel).toBe('10m');
		expect(poisoned?.durationLabel).toBe('2h');
	});

	it('includes inactive catalog conditions when includeInactive is true', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: id,
			img: `${id}.svg`,
		}));

		const actor = {
			conditionsMetadata: {
				active: new Set<string>(),
				overlay: new Set<string>(),
			},
			effects: [],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor, { includeInactive: true });
		const blinded = result.find((condition) => condition.id === 'blinded');

		expect(blinded).toBeDefined();
		expect(blinded?.active).toBe(false);
	});

	it('does not include non-standard effect statuses when includeInactive is true', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn((id: string) => ({
			id,
			name: id,
			img: `${id}.svg`,
		}));

		const actor = {
			conditionsMetadata: {
				active: new Set<string>(),
				overlay: new Set<string>(),
			},
			effects: [
				createEffect({ statuses: ['test-haste'], duration: { rounds: 3 }, sourceName: 'Haste' }),
			],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor, { includeInactive: true });
		expect(result.find((condition) => condition.id === 'test-haste')).toBeUndefined();
	});

	it('includes non-standard effect statuses when includeEffectStatuses is true', () => {
		(game.nimble.conditions as { get: (id: string) => unknown }).get = vi.fn(() => undefined);

		const actor = {
			conditionsMetadata: {
				active: new Set<string>(),
				overlay: new Set<string>(),
			},
			effects: [
				{
					name: 'Test Haste',
					img: 'icons/svg/aura.svg',
					statuses: new Set(['test-haste']),
					duration: { rounds: 3 },
					sourceName: 'Haste Source',
				},
			],
		} as unknown as Actor.Implementation;

		const result = prepareActorConditions(actor, { includeEffectStatuses: true });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('test-haste');
		expect(result[0].name).toBe('Test Haste');
		expect(result[0].img).toBe('icons/svg/aura.svg');
		expect(result[0].active).toBe(true);
		expect(result[0].durationLabel).toBe('3r');
	});
});
