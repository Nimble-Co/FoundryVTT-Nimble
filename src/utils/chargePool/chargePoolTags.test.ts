import { describe, expect, it } from 'vitest';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { populateChargePoolTags } from './chargePoolTags.js';

const { flagScope, flagKey } = ChargePoolRuleConfig;

function flagBag(pools: unknown): Record<string, unknown> {
	return { [flagScope]: { [flagKey]: pools } };
}

function collect(flagSource: {
	flags?: unknown;
	items?: { contents: Array<{ flags?: unknown }> };
}): Set<string> {
	const tags = new Set<string>();
	populateChargePoolTags(flagSource, tags);
	return tags;
}

describe('populateChargePoolTags', () => {
	it('emits the current count for an actor-scoped pool on actor flags', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: 2, max: 3 },
			}),
		});

		expect(tags.has('self:focusChargePool:2')).toBe(true);
		expect(tags.has('self:noFocusCharges')).toBe(false);
		expect(tags.has('self:focusChargesMax')).toBe(false);
	});

	it('emits tags for an item-scoped pool on item flags', () => {
		const tags = collect({
			flags: {},
			items: {
				contents: [
					{
						flags: flagBag({
							spark: { identifier: 'spark', current: 1, max: 4 },
						}),
					},
				],
			},
		});

		expect(tags.has('self:sparkChargePool:1')).toBe(true);
	});

	it('strips the actor: prefix when falling back to the storage key', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { current: 1, max: 2 },
			}),
		});

		expect(tags.has('self:focusChargePool:1')).toBe(true);
		expect(tags.has('self:actor:focusChargePool:1')).toBe(false);
	});

	it('emits the zero-state tag when the pool is empty', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: 0, max: 3 },
			}),
		});

		expect(tags.has('self:focusChargePool:0')).toBe(true);
		expect(tags.has('self:noFocusCharges')).toBe(true);
		expect(tags.has('self:focusChargesMax')).toBe(false);
	});

	it('emits the full-state tag when the pool is at max', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: 3, max: 3 },
			}),
		});

		expect(tags.has('self:focusChargePool:3')).toBe(true);
		expect(tags.has('self:focusChargesMax')).toBe(true);
		expect(tags.has('self:noFocusCharges')).toBe(false);
	});

	it('does not emit a full-state tag for a pool with a max of zero', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: 0, max: 0 },
			}),
		});

		expect(tags.has('self:focusChargesMax')).toBe(false);
		expect(tags.has('self:noFocusCharges')).toBe(true);
	});

	it('coerces string counts and clamps negatives', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: '2', max: '3' },
				'actor:ember': { identifier: 'ember', current: -4, max: 3 },
			}),
		});

		expect(tags.has('self:focusChargePool:2')).toBe(true);
		expect(tags.has('self:emberChargePool:0')).toBe(true);
		expect(tags.has('self:noEmberCharges')).toBe(true);
	});

	it('emits both actor-scoped and item-scoped pools in one pass', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', current: 1, max: 1 },
			}),
			items: {
				contents: [
					{
						flags: flagBag({
							spark: { identifier: 'spark', current: 0, max: 2 },
						}),
					},
				],
			},
		});

		expect(tags.has('self:focusChargePool:1')).toBe(true);
		expect(tags.has('self:focusChargesMax')).toBe(true);
		expect(tags.has('self:sparkChargePool:0')).toBe(true);
		expect(tags.has('self:noSparkCharges')).toBe(true);
	});

	it('skips pools with a blank identifier', () => {
		const tags = collect({
			flags: flagBag({
				'   ': { identifier: '   ', current: 1, max: 2 },
				'actor:': { current: 1, max: 2 },
			}),
		});

		expect(tags.size).toBe(0);
	});

	it('skips pools whose current value is not a finite number', () => {
		const tags = collect({
			flags: flagBag({
				'actor:focus': { identifier: 'focus', max: 3 },
				'actor:ember': { identifier: 'ember', current: 'many', max: 3 },
			}),
		});

		expect(tags.size).toBe(0);
	});

	it('tolerates malformed flag bags without throwing', () => {
		expect(collect({}).size).toBe(0);
		expect(collect({ flags: null }).size).toBe(0);
		expect(collect({ flags: 'nope' }).size).toBe(0);
		expect(collect({ flags: { [flagScope]: [] } }).size).toBe(0);
		expect(collect({ flags: { [flagScope]: { [flagKey]: [] } } }).size).toBe(0);
		expect(collect({ flags: { [flagScope]: { [flagKey]: 'nope' } } }).size).toBe(0);
		expect(collect({ flags: flagBag({ focus: null }) }).size).toBe(0);
		expect(collect({ flags: flagBag({ focus: 3 }) }).size).toBe(0);
		expect(collect({ flags: {}, items: { contents: [{ flags: undefined }] } }).size).toBe(0);
	});
});
