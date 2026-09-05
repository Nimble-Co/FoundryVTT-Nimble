import { describe, expect, it } from 'vitest';
import { Migration048LayOnHandsPool } from './Migration048LayOnHandsPool.js';

function createFeature(overrides: Record<string, unknown> = {}) {
	return {
		type: 'feature',
		name: 'Lay on Hands',
		_stats: { compendiumSource: 'Compendium.nimble.nimble-class-features.Item.Ddm1A7P01CcmPrim' },
		system: {
			rules: [],
			activation: {
				skipRollDialog: true,
				effects: [
					{
						id: 'LayOnHandsHealing1',
						type: 'healing',
						healingType: 'healing',
						formula: '5*@level',
					},
				],
			},
		},
		...overrides,
	} as any;
}

describe('Migration048LayOnHandsPool', () => {
	it('adds the pool and points the healing at what was spent', async () => {
		const feature = createFeature();

		await new Migration048LayOnHandsPool().updateItem!(feature);

		expect(feature.system.rules.map((rule: any) => rule.type)).toEqual([
			'chargePool',
			'chargeConsumer',
		]);
		expect(feature.system.rules[1].costMode).toBe('variable');
		expect(feature.system.activation.effects[0].formula).toBe('@spent');
		// The amount is named in the dialog, so it can no longer be skipped.
		expect(feature.system.activation.skipRollDialog).toBe(false);
	});

	it('matches a copy that lost its compendium source by name', async () => {
		const feature = createFeature({ _stats: {} });

		await new Migration048LayOnHandsPool().updateItem!(feature);

		expect(feature.system.rules).toHaveLength(2);
	});

	it('matches a copy stored under the dev build namespace', async () => {
		// `dev-rebrand.mjs` rewrites packs but not src, so an actor's copy on the
		// dev build stores `Compendium.nimble-dev.…` for the same document.
		const feature = createFeature({
			_stats: {
				compendiumSource: 'Compendium.nimble-dev.nimble-class-features.Item.Ddm1A7P01CcmPrim',
			},
		});

		await new Migration048LayOnHandsPool().updateItem!(feature);

		expect(feature.system.rules).toHaveLength(2);
		expect(feature.system.activation.effects[0].formula).toBe('@spent');
	});

	it('leaves a feature from another compendium alone', async () => {
		const feature = createFeature({
			_stats: { compendiumSource: 'Compendium.homebrew.features.Item.abcdefghijklmnop' },
		});

		await new Migration048LayOnHandsPool().updateItem!(feature);

		expect(feature.system.rules).toHaveLength(0);
	});

	it('runs twice without adding a second pool', async () => {
		const feature = createFeature();
		const migration = new Migration048LayOnHandsPool();

		await migration.updateItem!(feature);
		await migration.updateItem!(feature);

		expect(feature.system.rules).toHaveLength(2);
	});

	it('keeps a healing formula the GM has already changed', async () => {
		const feature = createFeature();
		feature.system.activation.effects[0].formula = '10*@level';

		await new Migration048LayOnHandsPool().updateItem!(feature);

		expect(feature.system.activation.effects[0].formula).toBe('10*@level');
	});
});
