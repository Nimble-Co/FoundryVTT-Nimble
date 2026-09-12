import { afterEach, describe, expect, it, vi } from 'vitest';
import shadowmancerClass from '../../../packs/classes/core/shadowmancer.json';
import pilferedPower from '../../../packs/classFeatures/core/shadowmancer/shadowmancer-progression/pilfered-power.json';
import heartOfBurningFire from '../../../packs/classFeatures/core/shadowmancer/shadowmancer-subclasses/pact-of-the-red-dragon/heart-of-burning-fire.json';
import { Migration052ShadowmancerPilferedPower } from './Migration052ShadowmancerPilferedPower.js';

function shadowmancer(mana: Record<string, unknown> | undefined) {
	return {
		items: [{ type: 'class', system: { identifier: 'shadowmancer' } }],
		system: { resources: { mana } },
	};
}

describe('Migration052ShadowmancerPilferedPower.updateActor', () => {
	const migration = new Migration052ShadowmancerPilferedPower();
	const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

	afterEach(() => log.mockClear());

	it('clears a positive mana current and logs it', async () => {
		const source = shadowmancer({ current: 3 });

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({ current: 0 });
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves an undefined mana current alone without logging', async () => {
		const source = shadowmancer({});

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({});
		expect(log).not.toHaveBeenCalled();
	});

	it('leaves a zero mana current alone without logging', async () => {
		const source = shadowmancer({ current: 0 });

		await migration.updateActor(source);

		expect(source.system.resources.mana).toEqual({ current: 0 });
		expect(log).not.toHaveBeenCalled();
	});

	it('skips an actor with a non-Shadowmancer class', async () => {
		const source = {
			items: [
				{ type: 'class', system: { identifier: 'shadowmancer' } },
				{ type: 'class', system: { identifier: 'mage' } },
			],
			system: { resources: { mana: { current: 3 } } },
		};

		await migration.updateActor(source);

		expect(source.system.resources.mana.current).toBe(3);
		expect(log).not.toHaveBeenCalled();
	});
});

describe('Migration052ShadowmancerPilferedPower.updateItem', () => {
	const migration = new Migration052ShadowmancerPilferedPower();
	vi.spyOn(console, 'log').mockImplementation(() => undefined);

	function withoutRules(packItem: object): any {
		const source = structuredClone(packItem) as any;
		source.system.rules = [];
		return source;
	}

	it.each([
		['Pilfered Power', pilferedPower],
		['Heart of Burning Fire', heartOfBurningFire],
	])('gives an old %s the rules the pack ships', async (_name, packItem) => {
		const source = withoutRules(packItem);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(packItem.system.rules);
	});

	it('gives an old Shadowmancer class the spell cost the pack ships', async () => {
		const source = structuredClone(shadowmancerClass) as any;
		delete source.system.spellcasting;
		source.system.mana.formula = '(max(@dexterity, 0))';

		await migration.updateItem(source);

		expect(source.system.spellcasting).toEqual(shadowmancerClass.system.spellcasting);
		expect(source.system.mana.formula).toBe('');
	});

	it('regains the Heart of Burning Fire use once per combat, not on each initiative roll', async () => {
		const source = withoutRules(heartOfBurningFire);

		await migration.updateItem(source);

		expect(source.system.rules[0].addRefills).toEqual([
			expect.objectContaining({ trigger: 'encounterStart', mode: 'add' }),
		]);
	});
});
