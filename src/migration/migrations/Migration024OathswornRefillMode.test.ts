import { describe, expect, it } from 'vitest';
import { Migration024OathswornRefillMode } from './Migration024OathswornRefillMode.js';

const RADIANT_JUDGEMENT_SOURCE_ID = 'Compendium.nimble.class-features.Item.qiQeJrIxla9y6XY0';

function makeRadiantJudgement(refillOverride?: Record<string, unknown>): any {
	return {
		type: 'feature',
		name: 'Radiant Judgement',
		_stats: { compendiumSource: RADIANT_JUDGEMENT_SOURCE_ID },
		system: {
			rules: [
				{
					type: 'dicePool',
					id: 'judgment-pool-base',
					identifier: 'judgment',
					label: 'Judgment Dice',
					dieSize: 'd6',
					max: '2',
					initial: 'zero',
					refills: [
						refillOverride ?? {
							trigger: 'onAttacked',
							mode: 'set',
							value: '2',
						},
					],
				},
				{
					type: 'modifyPool',
					id: 'judgment-plus1-l14',
					poolType: 'dice',
					poolIdentifier: 'judgment',
					maxDelta: '+1',
				},
			],
		},
	};
}

describe('Migration024OathswornRefillMode', () => {
	it('rewrites the onAttacked refill to setIfEmpty / @poolMax', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = makeRadiantJudgement();

		await migration.updateItem!(item);

		const refill = item.system.rules[0].refills[0];
		expect(refill.mode).toBe('setIfEmpty');
		expect(refill.value).toBe('@poolMax');
		expect(refill.trigger).toBe('onAttacked');
	});

	it('is idempotent on already-migrated items', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = makeRadiantJudgement({
			trigger: 'onAttacked',
			mode: 'setIfEmpty',
			value: '@poolMax',
		});

		await migration.updateItem!(item);

		const refill = item.system.rules[0].refills[0];
		expect(refill.mode).toBe('setIfEmpty');
		expect(refill.value).toBe('@poolMax');
	});

	it('leaves non-Radiant-Judgement features alone', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = {
			type: 'feature',
			name: 'Rage',
			_stats: { compendiumSource: 'Compendium.nimble.class-features.Item.GjPt8evcIoVuQ6zg' },
			system: {
				rules: [
					{
						type: 'dicePool',
						id: 'fury-pool-base',
						refills: [{ trigger: 'onAttacked', mode: 'set', value: '2' }],
					},
				],
			},
		};

		await migration.updateItem!(item);

		expect(item.system.rules[0].refills[0]).toEqual({
			trigger: 'onAttacked',
			mode: 'set',
			value: '2',
		});
	});

	it('leaves homebrew copies (no sourceId) alone', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = {
			type: 'feature',
			name: 'Radiant Judgement (homebrew)',
			system: {
				rules: [
					{
						type: 'dicePool',
						id: 'judgment-pool-base',
						refills: [{ trigger: 'onAttacked', mode: 'set', value: '2' }],
					},
				],
			},
		};

		await migration.updateItem!(item);

		expect(item.system.rules[0].refills[0].mode).toBe('set');
		expect(item.system.rules[0].refills[0].value).toBe('2');
	});

	it('ignores items without the judgment-pool-base rule (defensive)', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = {
			type: 'feature',
			_stats: { compendiumSource: RADIANT_JUDGEMENT_SOURCE_ID },
			system: { rules: [] },
		};

		await expect(migration.updateItem!(item)).resolves.toBeUndefined();
	});

	it('also detects sourceId from flags.core.sourceId (legacy)', async () => {
		const migration = new Migration024OathswornRefillMode();
		const item = {
			type: 'feature',
			flags: { core: { sourceId: RADIANT_JUDGEMENT_SOURCE_ID } },
			system: {
				rules: [
					{
						type: 'dicePool',
						id: 'judgment-pool-base',
						refills: [{ trigger: 'onAttacked', mode: 'set', value: '2' }],
					},
				],
			},
		};

		await migration.updateItem!(item);

		const refill = item.system.rules[0].refills[0];
		expect(refill.mode).toBe('setIfEmpty');
		expect(refill.value).toBe('@poolMax');
	});
});
