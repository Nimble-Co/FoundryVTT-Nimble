import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { SaveOnEventRule } from '../saveOnEvent.js';

function makeRule(saveDC: string, rollData: Record<string, unknown> = {}) {
	const actor = {
		uuid: 'Actor.tessa',
		getRollData: () => rollData,
		getDomain: () => new Set<string>(),
	};
	const effect = {
		isEmbedded: true,
		actor,
		parent: actor,
		name: 'Concentration',
		getDomain: () => new Set<string>(),
	};
	const rule = new SaveOnEventRule({ type: 'saveOnEvent' } as never, {
		parent: effect as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, { disabled: false, saveDC, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => effect, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
	return rule;
}

describe('SaveOnEventRule', () => {
	it('works only on an effect, as a failure ends the effect it is on', () => {
		expect(SaveOnEventRule.worksOnItems).toBe(false);
	});

	it('asks a crit for a DC 10 STR save by default', () => {
		const schema = SaveOnEventRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.event?.initial).toBe('critReceived');
		expect(schema.saveType?.initial).toBe('strength');
	});

	it('reads its DC from a number or from the stats of the holder', () => {
		expect(makeRule('12').dc).toBe(12);
		expect(makeRule('10 + @strength', { strength: 3 }).dc).toBe(13);
	});

	it('falls back to DC 10 for a formula with no number', () => {
		expect(makeRule('').dc).toBe(10);
	});
});
