import { describe, expect, it } from 'vitest';

import collectOptionPicks from './collectOptionPicks.ts';

const SOURCE_BY_ITEM: Record<string, string> = {
	'item-die-6': 'uuid:die',
	'item-die-8': 'uuid:die',
	'item-die-hand': 'uuid:die',
	'item-tactic': 'uuid:tactic',
	'item-orders': 'uuid:orders',
	'item-no-source': '',
};

const sourceOf = (itemId: string) => SOURCE_BY_ITEM[itemId];

describe('collectOptionPicks', () => {
	it('counts a source granted at two levels as two picks', () => {
		const picks = collectOptionPicks(
			[
				{ level: 6, grantedFeatureIds: ['item-die-6'] },
				{ level: 8, grantedFeatureIds: ['item-die-8'] },
			],
			sourceOf,
		);

		expect(picks.get('uuid:die')).toEqual(['item-die-6', 'item-die-8']);
	});

	it('counts a source held twice but granted once as one pick', () => {
		// The second copy is on the sheet but no level recorded it, so it is not a pick.
		const picks = collectOptionPicks([{ level: 6, grantedFeatureIds: ['item-die-6'] }], sourceOf);

		expect(picks.get('uuid:die')).toEqual(['item-die-6']);
	});

	it('yields nothing for a source held but granted at no level', () => {
		const picks = collectOptionPicks([{ level: 4, grantedFeatureIds: ['item-tactic'] }], sourceOf);

		expect(picks.has('uuid:die')).toBe(false);
		expect(picks.get('uuid:tactic')).toEqual(['item-tactic']);
	});

	it('yields nothing for a history id whose item is gone', () => {
		const picks = collectOptionPicks(
			[{ level: 6, grantedFeatureIds: ['item-deleted', 'item-no-source'] }],
			sourceOf,
		);

		expect(picks.size).toBe(0);
	});

	it('orders the ids oldest granting level first, whatever order the entries arrive in', () => {
		const picks = collectOptionPicks(
			[
				{ level: 8, grantedFeatureIds: ['item-die-8'] },
				{ level: 2, grantedFeatureIds: ['item-orders'] },
				{ level: 6, grantedFeatureIds: ['item-die-6'] },
			],
			sourceOf,
		);

		expect(picks.get('uuid:die')).toEqual(['item-die-6', 'item-die-8']);
	});

	it('counts an id recorded by two entries once', () => {
		const picks = collectOptionPicks(
			[
				{ level: 6, grantedFeatureIds: ['item-die-6'] },
				{ level: 8, grantedFeatureIds: ['item-die-6'] },
			],
			sourceOf,
		);

		expect(picks.get('uuid:die')).toEqual(['item-die-6']);
	});
});
