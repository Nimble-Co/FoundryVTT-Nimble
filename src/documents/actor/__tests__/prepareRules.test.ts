import { describe, expect, it } from 'vitest';
import { NimbleBaseActor } from '../base.svelte.js';

interface RuleStub {
	id: string;
	disabled: boolean;
	priority: number;
}

const rule = (id: string, priority = 1, disabled = false): RuleStub => ({ id, disabled, priority });

const rulesOf = (...rules: RuleStub[]) => new Map(rules.map((r) => [r.id, r]));

function effect(rules: RuleStub[], modifiesActor = true) {
	return { rules: rulesOf(...rules), modifiesActor };
}

function prepareRules(items: object[], effects: object[]): string[] {
	const stub = {
		items: { contents: items },
		*allApplicableEffects() {
			yield* effects;
		},
	};
	const prepare = (
		NimbleBaseActor.prototype as unknown as { prepareRules(this: unknown): RuleStub[] }
	).prepareRules;
	return prepare.call(stub).map((r) => r.id);
}

describe('prepareRules', () => {
	it('reads the rules of the items and of the effects that change the actor', () => {
		const ids = prepareRules(
			[{ rules: rulesOf(rule('item-rule')) }],
			[effect([rule('effect-rule')])],
		);

		expect(ids).toEqual(['item-rule', 'effect-rule']);
	});

	it('skips an effect that is off, expired or suppressed', () => {
		const ids = prepareRules([], [effect([rule('off')], false), effect([rule('on')])]);

		expect(ids).toEqual(['on']);
	});

	it('counts the rule of an effect an item transfers once', () => {
		const transferred = effect([rule('aura')]);

		const ids = prepareRules(
			[{ rules: rulesOf(rule('feature')), effects: [transferred] }],
			[transferred],
		);

		expect(ids.filter((id) => id === 'aura')).toHaveLength(1);
	});

	it('skips an effect with no rules, such as a core base effect', () => {
		const ids = prepareRules([], [{ modifiesActor: true }]);

		expect(ids).toEqual([]);
	});

	it('drops disabled rules and sorts all rules by priority', () => {
		const ids = prepareRules(
			[{ rules: rulesOf(rule('late', 5), rule('off', 1, true)) }],
			[effect([rule('early', 0)])],
		);

		expect(ids).toEqual(['early', 'late']);
	});
});
