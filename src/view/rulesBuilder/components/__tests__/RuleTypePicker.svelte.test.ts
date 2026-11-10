import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRuleTypePickerState } from '../RuleTypePicker.svelte.js';

const nimble = CONFIG.NIMBLE as unknown as Record<string, unknown>;
let saved: Record<string, unknown>;

beforeEach(() => {
	saved = { ruleDataModels: nimble.ruleDataModels, ruleTypes: nimble.ruleTypes };
	nimble.ruleDataModels = {
		note: { group: 'notes', description: 'Note', worksOnEffects: true },
		grantItem: { group: 'grants', description: 'Grant', worksOnEffects: false },
	};
	nimble.ruleTypes = { note: 'Note', grantItem: 'Grant Item' };
});

afterEach(() => {
	Object.assign(nimble, saved);
});

const labels = (forEffect?: boolean) =>
	createRuleTypePickerState(
		forEffect === undefined ? undefined : () => forEffect,
	).groupedEntries.flatMap(({ entries }) => entries.map((entry) => entry.label));

describe('RuleTypePicker', () => {
	it('offers every rule type for an item', () => {
		expect(labels().sort()).toEqual(['Grant Item', 'Note']);
	});

	it('hides the rule types that work only on an item, for an effect', () => {
		expect(labels(true)).toEqual(['Note']);
	});
});
