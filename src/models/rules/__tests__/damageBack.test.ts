import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DamageBackRule } from '../damageBack.js';

function makeRule(config: Record<string, unknown> = {}, isEmbedded = true) {
	const actor = { uuid: 'Actor.hero', getDomain: () => new Set<string>(['self:ready']) };
	const item = { isEmbedded, actor, name: 'Feature', getDomain: () => new Set<string>() };
	const rule = new DamageBackRule({ type: 'damageBack' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		onlyCrits: true,
		woundDoubles: false,
		predicate: new Predicate({}),
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

describe('DamageBackRule', () => {
	it('answers only crits by default', () => {
		const schema = DamageBackRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.onlyCrits?.initial).toBe(true);
		expect(makeRule().answersAttack({ isCritical: true })).toBe(true);
		expect(makeRule().answersAttack({ isCritical: false })).toBe(false);
	});

	it('answers every attack without "only crits"', () => {
		expect(makeRule({ onlyCrits: false }).answersAttack({ isCritical: false })).toBe(true);
	});

	it('does not answer on an item that is not on a creature', () => {
		expect(makeRule({}, false).answersAttack({ isCritical: true })).toBe(false);
	});

	it('does not answer when its predicate fails', () => {
		const rule = makeRule({ predicate: new Predicate({ self: 'other' } as never) });
		expect(rule.answersAttack({ isCritical: true })).toBe(false);
	});
});
