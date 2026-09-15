import { beforeEach, describe, expect, it, vi } from 'vitest';

const settingsGet = vi.fn();
const settingsSet = vi.fn(async () => undefined);

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
		settingsSet.mockResolvedValue(undefined);
	});

	it('seeds the declared sorting mode for a pack the user has no preference for', async () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({});

		await applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-rules': 'm',
		});
	});

	it('rebuilds the cached tree of every seeded pack', async () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({});

		await applyPackSortingModes();

		expect(rules.initializeTree).toHaveBeenCalledTimes(1);
	});

	it('leaves a preference the user has already chosen untouched', async () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({ 'nimble.nimble-rules': 'a' });

		await applyPackSortingModes();

		expect(settingsSet).not.toHaveBeenCalled();
		expect(rules.initializeTree).not.toHaveBeenCalled();
	});

	it('ignores packs that do not declare a sorting mode', async () => {
		const spells = makePack('nimble.nimble-spells');
		setPacks(spells);
		settingsGet.mockReturnValue({});

		await applyPackSortingModes();

		expect(settingsSet).not.toHaveBeenCalled();
		expect(spells.initializeTree).not.toHaveBeenCalled();
	});

	it('preserves preferences for other packs when seeding', async () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue({ 'nimble.nimble-monsters': 'm' });

		await applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-monsters': 'm',
			'nimble.nimble-rules': 'm',
		});
	});

	it('tolerates the setting being unset', async () => {
		const rules = makePack('nimble.nimble-rules', { nimble: { sorting: 'm' } });
		setPacks(rules);
		settingsGet.mockReturnValue(undefined);

		await applyPackSortingModes();

		expect(settingsSet).toHaveBeenCalledWith('core', 'collectionSortingModes', {
			'nimble.nimble-rules': 'm',
		});
	});
});
