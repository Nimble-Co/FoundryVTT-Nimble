import { describe, expect, it } from 'vitest';
import { fixedChargeCostsOf } from '../fixedChargeCosts.js';

const pool = {
	type: 'chargePool',
	id: 'pool',
	identifier: 'thrill',
	label: 'Thrill',
	scope: 'actor',
	max: '5',
	initial: 'max',
	recoveries: [],
};

function heroWith(consumer: object, type = 'character') {
	const rules = new Map<string, object>([
		['0', pool],
		[
			'1',
			{
				type: 'chargeConsumer',
				id: 'c',
				poolIdentifier: 'thrill',
				poolScope: 'actor',
				...consumer,
			},
		],
	]);
	const item = { id: 'i', name: 'Shot', rules, flags: {} };
	const actor = {
		type,
		items: { contents: [item], get: () => item },
		getRollData: () => ({}),
		getDomain: () => new Set<string>(),
		flags: {},
	};
	Object.assign(item, { actor });
	return { actor, item };
}

describe('fixedChargeCostsOf', () => {
	it('lists what a use spends by itself, with what is left', () => {
		const { actor, item } = heroWith({ cost: '2' });
		expect(fixedChargeCostsOf(actor, item)).toEqual([
			expect.objectContaining({ label: 'Thrill', amount: 2 }),
		]);
	});

	it('leaves out a cost the player picks', () => {
		const { actor, item } = heroWith({ cost: '1', costMode: 'variable' });
		expect(fixedChargeCostsOf(actor, item)).toEqual([]);
	});

	it('has nothing for a creature that is not a hero', () => {
		const { actor, item } = heroWith({ cost: '2' }, 'npc');
		expect(fixedChargeCostsOf(actor, item)).toEqual([]);
	});
});
