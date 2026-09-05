import { describe, expect, it } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { Predicate, type RawPredicate } from '../../etc/Predicate.js';
import { getHighestSpellTier } from './getHighestSpellTier.js';

type GrantRuleOptions = {
	tiers: number[];
	minLevel?: number;
	disabled?: boolean;
	type?: string;
	predicate?: unknown;
};

function createGrantRule({
	tiers,
	minLevel,
	disabled = false,
	type = 'grantSpells',
	predicate,
}: GrantRuleOptions) {
	return {
		type,
		tiers,
		disabled,
		predicate: predicate ?? (minLevel === undefined ? {} : { level: { min: minLevel } }),
	};
}

function createItem(rules: ReturnType<typeof createGrantRule>[], itemType = 'feature') {
	return {
		type: itemType,
		rules: new Map(rules.map((rule, index) => [String(index), rule])),
	};
}

/**
 * Binds each rule's `appliesTo` the way rule preparation does: the authored
 * predicate, evaluated against a domain carrying the character's level tag.
 * Building it here rather than stubbing a boolean keeps the tests honest about
 * which predicates the real engine would accept.
 */
function createActor(level: number, items: ReturnType<typeof createItem>[]): NimbleCharacter {
	const domain = new Set([`level:${level}`]);

	for (const item of items) {
		for (const rule of item.rules?.values() ?? []) {
			const authored = (rule as { predicate?: unknown }).predicate;
			// A prepared rule holds a Predicate instance, whose raw data sits on
			// `_source`; unwrap it so the fixture evaluates what was authored.
			const raw = (
				authored && typeof authored === 'object' && '_source' in authored
					? (authored as { _source: unknown })._source
					: authored
			) as RawPredicate;
			(rule as { appliesTo?: () => boolean }).appliesTo = () => new Predicate(raw).test(domain);
		}
	}

	return {
		levels: { character: level, classes: {} },
		items: { contents: items },
	} as unknown as NimbleCharacter;
}

const MAGE_LADDER = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((tier) =>
	createGrantRule({ tiers: [tier], minLevel: tier * 2 }),
);

const SHADOWMANCER_LADDER = [
	createGrantRule({ tiers: [0], minLevel: 2 }),
	createGrantRule({ tiers: [1], minLevel: 2 }),
	createGrantRule({ tiers: [2], minLevel: 5 }),
	createGrantRule({ tiers: [3], minLevel: 7 }),
	createGrantRule({ tiers: [4], minLevel: 10 }),
	createGrantRule({ tiers: [5], minLevel: 13 }),
	createGrantRule({ tiers: [6], minLevel: 16 }),
	createGrantRule({ tiers: [7], minLevel: 19 }),
];

describe('getHighestSpellTier', () => {
	it('returns 0 for a character with no items', () => {
		expect(getHighestSpellTier(createActor(10, []))).toBe(0);
	});

	it.each([
		[1, 0],
		[2, 1],
		[3, 1],
		[4, 2],
		[10, 5],
		[18, 9],
		[20, 9],
	])('derives tier %2$i at level %1$i from an evenly spaced ladder', (level, expectedTier) => {
		const actor = createActor(level, [createItem(MAGE_LADDER)]);
		expect(getHighestSpellTier(actor)).toBe(expectedTier);
	});

	it.each([
		[1, 0],
		[2, 1],
		[4, 1],
		[5, 2],
		[7, 3],
		[10, 4],
		[13, 5],
		[16, 6],
		[19, 7],
		[20, 7],
	])('derives tier %2$i at level %1$i from an uneven ladder', (level, expectedTier) => {
		const actor = createActor(level, [createItem(SHADOWMANCER_LADDER)]);
		expect(getHighestSpellTier(actor)).toBe(expectedTier);
	});

	it('takes the highest tier across class and subclass grants that disagree', () => {
		const classFeature = createItem([createGrantRule({ tiers: [2], minLevel: 5 })]);
		const subclassFeature = createItem([createGrantRule({ tiers: [3], minLevel: 5 })]);

		expect(getHighestSpellTier(createActor(5, [classFeature, subclassFeature]))).toBe(3);
	});

	it('ignores grants that have no level threshold', () => {
		const feature = createItem([createGrantRule({ tiers: [3] })]);

		expect(getHighestSpellTier(createActor(20, [feature]))).toBe(0);
	});

	it('ignores disabled grants', () => {
		const feature = createItem([createGrantRule({ tiers: [3], minLevel: 2, disabled: true })]);

		expect(getHighestSpellTier(createActor(10, [feature]))).toBe(0);
	});

	it('ignores rules that are not spell grants', () => {
		const feature = createItem([createGrantRule({ tiers: [3], minLevel: 2, type: 'grantItem' })]);

		expect(getHighestSpellTier(createActor(10, [feature]))).toBe(0);
	});

	it('treats a character with only cantrip grants as having no unlocked tier', () => {
		const feature = createItem([createGrantRule({ tiers: [0], minLevel: 2 })]);

		expect(getHighestSpellTier(createActor(10, [feature]))).toBe(0);
	});

	it('ignores grants on items that are not class, subclass, or feature items', () => {
		const wand = createItem([createGrantRule({ tiers: [3], minLevel: 1 })], 'object');
		const background = createItem([createGrantRule({ tiers: [2], minLevel: 1 })], 'background');

		expect(getHighestSpellTier(createActor(10, [wand, background]))).toBe(0);
	});

	it('reads grants on class and subclass items themselves', () => {
		const classItem = createItem([createGrantRule({ tiers: [1], minLevel: 2 })], 'class');
		const subclassItem = createItem([createGrantRule({ tiers: [2], minLevel: 3 })], 'subclass');

		expect(getHighestSpellTier(createActor(3, [classItem, subclassItem]))).toBe(2);
	});

	it('uses the highest value in a grant with multiple tiers', () => {
		const feature = createItem([createGrantRule({ tiers: [0, 1, 2], minLevel: 4 })]);

		expect(getHighestSpellTier(createActor(4, [feature]))).toBe(2);
	});

	it('reads the raw predicate from a prepared Predicate instance', () => {
		const feature = createItem([
			createGrantRule({ tiers: [1], predicate: { _source: { level: { min: 2 } } } }),
		]);

		expect(getHighestSpellTier(createActor(2, [feature]))).toBe(1);
	});

	it('honours every part of the predicate, not only its minimum level', () => {
		// The minimum is met but the maximum is not, so the grant does not apply.
		// A derivation that read `level.min` alone would hand out the tier.
		const feature = createItem([
			createGrantRule({ tiers: [3], predicate: { level: { min: 2, max: 4 } } }),
		]);

		expect(getHighestSpellTier(createActor(10, [feature]))).toBe(0);
		expect(getHighestSpellTier(createActor(3, [feature]))).toBe(3);
	});

	it('skips items with no prepared rules', () => {
		const bareItem = { type: 'feature' } as unknown as ReturnType<typeof createItem>;

		expect(getHighestSpellTier(createActor(10, [bareItem]))).toBe(0);
	});
});
