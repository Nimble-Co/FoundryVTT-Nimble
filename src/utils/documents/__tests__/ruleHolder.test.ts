import { describe, expect, it } from 'vitest';
import { actorOfRuleHolder, isEffectHolder, type RuleHolder } from '../ruleHolder.js';

const actor = { documentName: 'Actor', name: 'Tessa' };
const holder = (fields: object) => fields as unknown as RuleHolder;

describe('actorOfRuleHolder', () => {
	it('is the owner of an item', () => {
		expect(actorOfRuleHolder(holder({ documentName: 'Item', actor }))).toBe(actor);
	});

	it('is the actor that holds an effect', () => {
		const effect = holder({ documentName: 'ActiveEffect', parent: actor });

		expect(isEffectHolder(effect)).toBe(true);
		expect(actorOfRuleHolder(effect)).toBe(actor);
	});

	it('is the owner of the item that holds an effect', () => {
		const item = { documentName: 'Item', actor };

		expect(actorOfRuleHolder(holder({ documentName: 'ActiveEffect', parent: item }))).toBe(actor);
	});

	it('is null for a world item or no document', () => {
		expect(actorOfRuleHolder(holder({ documentName: 'Item', actor: null }))).toBeNull();
		expect(actorOfRuleHolder(null)).toBeNull();
	});
});
