import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChangeEffectRule } from '../changeEffect.js';

function makeActor(domain: string[] = []) {
	const actor = Object.create(Actor.prototype) as Record<string, unknown>;
	actor.getDomain = () => new Set(domain);
	return actor;
}

function changeRule(
	actor: object | null,
	source: { itemIdentifier: string; disabled?: boolean; predicate?: Record<string, unknown> },
): ChangeEffectRule {
	const rule = new ChangeEffectRule({ type: 'changeEffect' } as never, { strict: false });
	const item = { actor, isEmbedded: !!actor, name: 'Feature', getDomain: () => new Set() };
	Object.defineProperty(rule, 'parent', { value: item, configurable: true });
	Object.assign(rule, {
		itemIdentifier: source.itemIdentifier,
		removeMoments: ['zeroHp'],
		addMoments: [],
		disabled: source.disabled ?? false,
		predicate: new Predicate((source.predicate ?? {}) as never),
	});
	return rule;
}

describe('ChangeEffectRule', () => {
	it('is an item rule with moment lists that use the Lasts Until events', () => {
		const schema = ChangeEffectRule.defineSchema() as unknown as Record<
			string,
			{ element?: { choices?: Record<string, string> } }
		>;

		expect(ChangeEffectRule.worksOnEffects).toBe(false);
		expect(ChangeEffectRule.description).toBe('NIMBLE.rules.changeEffect.description');
		expect(schema.removeMoments.element?.choices?.zeroHp).toBe(
			'NIMBLE.rules.changeEffect.moments.choices.zeroHp',
		);
		expect(Object.keys(schema.addMoments.element?.choices ?? {})).toContain('inactiveRound');
	});

	it('changes the effects of the item it names, while it is on an actor', () => {
		const rule = changeRule(makeActor(), { itemIdentifier: ' rage ' });

		expect(rule.changesEffectsOf('rage')).toBe(true);
		expect(rule.changesEffectsOf('frenzy')).toBe(false);
	});

	it('changes nothing with no identifier, off an actor, or when disabled', () => {
		expect(changeRule(makeActor(), { itemIdentifier: '' }).changesEffectsOf('')).toBe(false);
		expect(changeRule(null, { itemIdentifier: 'rage' }).changesEffectsOf('rage')).toBe(false);
		expect(
			changeRule(makeActor(), { itemIdentifier: 'rage', disabled: true }).changesEffectsOf('rage'),
		).toBe(false);
	});

	it('changes the effects only while its predicate passes', () => {
		const predicate = { self: 'dying' };

		expect(
			changeRule(makeActor(), { itemIdentifier: 'rage', predicate }).changesEffectsOf('rage'),
		).toBe(false);
		expect(
			changeRule(makeActor(['self:dying']), { itemIdentifier: 'rage', predicate }).changesEffectsOf(
				'rage',
			),
		).toBe(true);
	});
});
