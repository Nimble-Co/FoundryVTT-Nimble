import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { TagsRule } from '../tags.js';

interface Holder {
	tags: Set<string>;
	getDomain(): Set<string>;
}

function makeActor(domain: string[] = []): Holder {
	const actor = Object.create(Actor.prototype) as Holder;
	actor.tags = new Set();
	actor.getDomain = () => new Set([...domain, ...actor.tags]);
	return actor;
}

function makeItem(actor: Holder | null) {
	return { actor, isEmbedded: !!actor, name: 'Feature', getDomain: () => new Set<string>() };
}

function makeEffect(actor: Holder | object, disabled = false) {
	return { documentName: 'ActiveEffect', target: actor, parent: actor, disabled, name: 'State' };
}

function tagsRule(
	parent: object,
	source: { tags: string[]; disabled?: boolean; predicate?: Record<string, unknown> },
): TagsRule {
	const rule = new TagsRule(
		{ type: 'tags', tags: source.tags, disabled: source.disabled ?? false } as never,
		{ strict: false },
	);
	Object.defineProperty(rule, 'parent', { value: parent, configurable: true });
	Object.assign(rule, {
		tags: source.tags,
		disabled: source.disabled ?? false,
		predicate: new Predicate((source.predicate ?? {}) as never),
	});
	return rule;
}

describe('TagsRule', () => {
	it('is listed for items and effects, and runs before the other rules read the tags', () => {
		expect(TagsRule.worksOnItems).toBe(true);
		expect(TagsRule.worksOnEffects).toBe(true);
		expect(TagsRule.appliesInPrePrepareData).toBe(true);
		expect(TagsRule.description).toBe('NIMBLE.rules.tags.description');
	});

	it('adds its tags while its item is on the actor, and skips blank tags', () => {
		const actor = makeActor();

		tagsRule(makeItem(actor), { tags: ['self:raging', ' ', 'self:heads'] }).prePrepareData();

		expect([...actor.tags]).toEqual(['self:raging', 'self:heads']);
	});

	it('adds nothing from an item that is not on an actor', () => {
		const rule = tagsRule(makeItem(null), { tags: ['self:raging'] });

		expect(() => rule.prePrepareData()).not.toThrow();
	});

	it('adds its tags while its effect is on the actor and enabled', () => {
		const actor = makeActor();

		tagsRule(makeEffect(actor), { tags: ['self:raging'] }).prePrepareData();

		expect([...actor.tags]).toEqual(['self:raging']);
	});

	it('adds nothing from a disabled effect, or an effect that waits on an item', () => {
		const actor = makeActor();

		tagsRule(makeEffect(actor, true), { tags: ['self:raging'] }).prePrepareData();
		tagsRule(makeEffect(makeItem(actor)), { tags: ['self:raging'] }).prePrepareData();

		expect(actor.tags.size).toBe(0);
	});

	it('adds nothing when the rule is disabled', () => {
		const actor = makeActor();

		tagsRule(makeItem(actor), { tags: ['self:raging'], disabled: true }).prePrepareData();

		expect(actor.tags.size).toBe(0);
	});

	it('adds its tags only while its predicate passes', () => {
		const calm = makeActor();
		const dying = makeActor(['self:dying']);
		const predicate = { self: 'dying' };

		tagsRule(makeItem(calm), { tags: ['self:enduring'], predicate }).prePrepareData();
		tagsRule(makeItem(dying), { tags: ['self:enduring'], predicate }).prePrepareData();

		expect(calm.tags.size).toBe(0);
		expect([...dying.tags]).toEqual(['self:enduring']);
	});

	it('stacks with other Tags rules on the same actor', () => {
		const actor = makeActor();

		tagsRule(makeItem(actor), { tags: ['self:raging'] }).prePrepareData();
		tagsRule(makeEffect(actor), { tags: ['self:raging', 'self:heads'] }).prePrepareData();

		expect([...actor.tags].sort()).toEqual(['self:heads', 'self:raging']);
	});
});
