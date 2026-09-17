import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsGet = vi.fn();
const settingsSet = vi.fn(() => Promise.resolve());

vi.stubGlobal('game', {
	settings: { get: settingsGet, set: settingsSet },
	packs: [],
});

import applyPackSortingModes from './packSortingModes.js';

function makePack(id: string, flags: Record<string, unknown> = {}) {
	return {
		metadata: { id, flags },
		initializeTree: vi.fn(),
	};
}

function setPacks(...packs: ReturnType<typeof makePack>[]) {
	(game as unknown as { packs: unknown[] }).packs = packs;
}

describe('packSortingModes', () => {
	beforeEach(() => {
		settingsGet.mockReset();
		settingsSet.mockReset();
		settingsSet.mockImplementation(() => Promise.resolve());
	});

	it('seeds the declared sorting mode for a pack the browser has no preference for', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({});

		applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-rules': 'm',
		});
	});

	it('rebuilds the cached tree of every seeded pack', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({});

		applyPackSortingModes();

		expect(rules.initializeTree).toHaveBeenCalledTimes(1);
	});

	it('leaves a preference already made in this browser untouched', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({ 'nimble.nimble-rules': 'a' });

		applyPackSortingModes();

		expect(settingsSet).not.toHaveBeenCalled();
		expect(rules.initializeTree).not.toHaveBeenCalled();
	});

	it('ignores packs that do not declare a sorting mode', () => {
		const spells = makePack('nimble.nimble-spells');
		setPacks(spells);
		settingsGet.mockReturnValue({});

		applyPackSortingModes();

		expect(settingsSet).not.toHaveBeenCalled();
		expect(spells.initializeTree).not.toHaveBeenCalled();
	});

	it('rebuilds only the seeded pack when others declare nothing', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		const spells = makePack('nimble.nimble-spells');
		const monsters = makePack('nimble.nimble-monsters');
		setPacks(spells, rules, monsters);
		settingsGet.mockReturnValue({});

		applyPackSortingModes();

		expect(rules.initializeTree).toHaveBeenCalledTimes(1);
		expect(spells.initializeTree).not.toHaveBeenCalled();
		expect(monsters.initializeTree).not.toHaveBeenCalled();
	});

	it('writes the setting before rebuilding any tree, so the rebuild reads the new mode', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		const boons = makePack('nimble.nimble-boons', { nimble: { sorting: 'm' } });
		setPacks(rules, boons);
		settingsGet.mockReturnValue({});

		applyPackSortingModes();

		const setOrder = settingsSet.mock.invocationCallOrder[0];
		expect(rules.initializeTree.mock.invocationCallOrder[0]).toBeGreaterThan(setOrder);
		expect(boons.initializeTree.mock.invocationCallOrder[0]).toBeGreaterThan(setOrder);
	});

	it('preserves preferences for other packs when seeding', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({ 'nimble.nimble-monsters': 'm' });

		applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-monsters': 'm',
			'nimble.nimble-rules': 'm',
		});
	});

	it('tolerates the setting being unset', () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue(undefined);

		applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-rules': 'm',
		});
	});
});
