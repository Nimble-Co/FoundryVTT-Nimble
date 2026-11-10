import { describe, expect, it } from 'vitest';
import { FreeSpellCostRule } from '../freeSpellCost.js';

interface RuleConfig {
	poolIdentifier?: string;
	disabled?: boolean;
	predicatePasses?: boolean;
	onActor?: boolean;
}

function createFreeSpellCostRule(config: RuleConfig = {}): FreeSpellCostRule {
	const holder = Object.setPrototypeOf({ getDomain: () => new Set<string>() }, Actor.prototype);
	const effect = {
		documentName: 'ActiveEffect',
		uuid: 'Actor.hero.ActiveEffect.e',
		parent: holder,
		target: (config.onActor ?? true) ? holder : null,
		origin: null,
	};
	const rule = new FreeSpellCostRule(
		{
			id: 'rule-id',
			type: 'freeSpellCost',
			poolIdentifier: config.poolIdentifier ?? 'pilfered-power',
		} as never,
		{ parent: effect as unknown as foundry.abstract.DataModel.Any, strict: false },
	);
	rule.poolIdentifier = config.poolIdentifier ?? 'pilfered-power';
	rule.disabled = config.disabled ?? false;
	Object.defineProperty(rule, 'parent', { get: () => effect, configurable: true });
	const predicatePasses = config.predicatePasses ?? true;
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: predicatePasses ? 0 : 1, test: () => predicatePasses }),
		configurable: true,
	});
	return rule;
}

describe('FreeSpellCostRule.makesFree', () => {
	it('makes a cost from its pool free', () => {
		expect(createFreeSpellCostRule().makesFree('pilfered-power')).toBe(true);
	});

	it('does not make a cost from another pool free', () => {
		expect(createFreeSpellCostRule().makesFree('stolen-power')).toBe(false);
	});

	it('makes a cost from any pool free when its pool is blank', () => {
		const rule = createFreeSpellCostRule({ poolIdentifier: '  ' });
		expect(rule.makesFree('pilfered-power')).toBe(true);
		expect(rule.makesFree('stolen-power')).toBe(true);
	});

	it('uses the trimmed pool', () => {
		expect(
			createFreeSpellCostRule({ poolIdentifier: ' pilfered-power ' }).makesFree('pilfered-power'),
		).toBe(true);
	});

	it('makes nothing free when disabled', () => {
		expect(createFreeSpellCostRule({ disabled: true }).makesFree('pilfered-power')).toBe(false);
	});

	it('makes nothing free when its predicate fails', () => {
		expect(createFreeSpellCostRule({ predicatePasses: false }).makesFree('pilfered-power')).toBe(
			false,
		);
	});

	it('makes nothing free when its effect is not on a creature', () => {
		expect(createFreeSpellCostRule({ onActor: false }).makesFree('pilfered-power')).toBe(false);
	});

	it('cannot go on an item', () => {
		expect(FreeSpellCostRule.worksOnItems).toBe(false);
	});
});
