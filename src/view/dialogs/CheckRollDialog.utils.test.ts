import { describe, expect, it, vi } from 'vitest';
import { getSituationalRollModeOptions } from './CheckRollDialog.utils.js';

// getSituationalRollModeOptions drives real SituationalRollModeRule instances in
// production, but its own logic (the filter chain, the target-key mapping, the label
// fallback) only depends on the rule's public methods, so lightweight fakes isolate it.
function createRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'situationalRollMode',
		id: 'rule-id',
		label: 'Against fear',
		value: 1,
		item: { name: 'Haunted Past', uuid: 'Item.hp1', img: 'icons/backgrounds/haunted-past.webp' },
		iconPath: vi.fn(() => 'icons/backgrounds/haunted-past.webp'),
		appliesTo: vi.fn(() => true),
		offersAdjustment: vi.fn(() => true),
		matchesRoll: vi.fn(() => true),
		...overrides,
	};
}

function createActor(rules: unknown[]) {
	return { rules } as never;
}

const willSave = { type: 'savingThrow', saveKey: 'will' } as const;

describe('getSituationalRollModeOptions', () => {
	describe('target key mapping', () => {
		it('passes the save key for saving throws', () => {
			const rule = createRule();
			getSituationalRollModeOptions(createActor([rule]), { type: 'savingThrow', saveKey: 'will' });
			expect(rule.matchesRoll).toHaveBeenCalledWith('savingThrow', 'will');
		});

		it('passes the ability key for ability checks', () => {
			const rule = createRule();
			getSituationalRollModeOptions(createActor([rule]), {
				type: 'abilityCheck',
				abilityKey: 'strength',
			});
			expect(rule.matchesRoll).toHaveBeenCalledWith('abilityCheck', 'strength');
		});

		it('passes the skill key for skill checks', () => {
			const rule = createRule();
			getSituationalRollModeOptions(createActor([rule]), {
				type: 'skillCheck',
				skillKey: 'stealth',
			});
			expect(rule.matchesRoll).toHaveBeenCalledWith('skillCheck', 'stealth');
		});

		// Initiative has no key of its own, and passing along whichever key happened to
		// be in the roll data would let an unrelated rule match.
		it('passes no key for initiative', () => {
			const rule = createRule();
			getSituationalRollModeOptions(createActor([rule]), {
				type: 'initiative',
				saveKey: 'will',
			});
			expect(rule.matchesRoll).toHaveBeenCalledWith('initiative', undefined);
		});
	});

	describe('filtering', () => {
		it('returns nothing without an actor', () => {
			expect(getSituationalRollModeOptions(null, willSave)).toEqual([]);
			expect(getSituationalRollModeOptions(undefined, willSave)).toEqual([]);
		});

		it('tolerates an actor with no rules', () => {
			expect(getSituationalRollModeOptions({}, willSave)).toEqual([]);
		});

		it('excludes rules of a different type', () => {
			const rule = createRule({ type: 'savingThrowRollMode' });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)).toEqual([]);
		});

		it('excludes rules that offer no adjustment', () => {
			const rule = createRule({ offersAdjustment: vi.fn(() => false) });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)).toEqual([]);
		});

		it('excludes rules that do not match the roll', () => {
			const rule = createRule({ matchesRoll: vi.fn(() => false) });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)).toEqual([]);
		});

		it('excludes rules whose predicate fails', () => {
			const rule = createRule({ appliesTo: vi.fn(() => false) });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)).toEqual([]);
		});

		it('returns every matching rule', () => {
			const rules = [createRule({ id: 'a' }), createRule({ id: 'b' })];
			expect(getSituationalRollModeOptions(createActor(rules), willSave)).toHaveLength(2);
		});
	});

	describe('option shape', () => {
		it('carries the label, icon, and adjustment', () => {
			const rule = createRule({ value: -2 });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)[0]).toMatchObject({
				label: 'Against fear',
				icon: 'icons/backgrounds/haunted-past.webp',
				value: -2,
			});
		});

		it('falls back to the item name when the rule has no label', () => {
			const rule = createRule({ label: '' });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)[0]?.label).toBe(
				'Haunted Past',
			);
		});

		it('falls back to the rule type name when neither label nor item name exists', () => {
			const rule = createRule({ label: '', item: undefined });
			expect(getSituationalRollModeOptions(createActor([rule]), willSave)[0]?.label).toBe(
				'Situational Roll Mode',
			);
		});

		// Rule ids are only unique within an item, so two copies of the same item would
		// otherwise share a key and collapse into one checkbox.
		it('scopes the key by item uuid so same-id rules on different items stay distinct', () => {
			const rules = [
				createRule({ item: { name: 'Haunted Past', uuid: 'Item.hp1' } }),
				createRule({ item: { name: 'Haunted Past', uuid: 'Item.hp2' } }),
			];
			const keys = getSituationalRollModeOptions(createActor(rules), willSave).map((o) => o.key);
			expect(keys).toEqual(['Item.hp1:rule-id', 'Item.hp2:rule-id']);
			expect(new Set(keys).size).toBe(2);
		});
	});
});
