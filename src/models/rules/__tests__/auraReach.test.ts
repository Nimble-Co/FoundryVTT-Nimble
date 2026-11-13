import { describe, expect, it } from 'vitest';
import { NimbleCharacter } from '../../../documents/actor/character.js';
import { Predicate } from '../../../etc/Predicate.js';
import { AuraReachRule } from '../auraReach.js';

function makeActor() {
	return {
		type: 'character',
		system: {
			abilities: { will: { mod: 2 } },
			savingThrows: {},
			skills: {},
			attributes: { auraReach: 0 },
		},
		classes: {},
		levels: { character: 9 },
		items: { contents: [] },
		flags: {},
		getDomain: () => new Set<string>(),
		getRollData(): Record<string, unknown> {
			return NimbleCharacter.prototype.getRollData.call(this as never);
		},
	};
}

function makeRule(actor: ReturnType<typeof makeActor>, value: string) {
	const item = { isEmbedded: true, actor, name: 'Aura', getDomain: () => new Set<string>() };
	const rule = new AuraReachRule({ type: 'auraReach' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, { disabled: false, predicate: new Predicate({}), value });
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
	return rule;
}

describe('AuraReachRule', () => {
	it('adds up the aura and its raises, and formulas read it as @auraReach', () => {
		const actor = makeActor();
		makeRule(actor, '4').prePrepareData();
		makeRule(actor, '2').prePrepareData();

		expect(actor.getRollData().auraReach).toBe(6);
	});

	it('is 0 for a hero with no aura', () => {
		expect(makeActor().getRollData().auraReach).toBe(0);
	});
});
