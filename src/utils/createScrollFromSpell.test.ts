import { describe, expect, it } from 'vitest';

import { SYSTEM_ID } from '#system';

import createScrollFromSpell, {
	getSpellScrollData,
	type ScrollSourceSpell,
	type SpellScrollFlagData,
} from './createScrollFromSpell.js';

function createSpell(overrides: Partial<ScrollSourceSpell> = {}): ScrollSourceSpell {
	return {
		uuid: 'Compendium.nimble.nimble-spells.Item.arcLightning',
		name: 'Arc Lightning',
		system: {
			school: 'lightning',
			tier: 1,
			description: { baseEffect: '<p>A bolt leaps to the nearest enemy.</p>' },
			activation: { cost: { quantity: 2, type: 'action' } },
		},
		...overrides,
	};
}

function scrollFlags(scroll: Record<string, unknown>): SpellScrollFlagData {
	const flags = scroll.flags as Record<string, { spellScroll: SpellScrollFlagData }>;
	return flags[SYSTEM_ID].spellScroll;
}

function scrollSystem(scroll: Record<string, unknown>) {
	return scroll.system as {
		activation: Record<string, unknown>;
		properties: { selected: string[] };
		description: { public: string };
		objectType: string;
		objectSizeType: string;
		slotsRequired: number;
		quantity: number;
		identified: boolean;
		price: { value: number; denomination: string };
	};
}

function scrollProperties(scroll: Record<string, unknown>): string[] {
	return scrollSystem(scroll).properties.selected;
}

describe('createScrollFromSpell', () => {
	it('names the scroll after the inscribed spell', () => {
		const scroll = createScrollFromSpell(createSpell(), { includeSpellDescription: true });

		expect(scroll.name).toBe('Scroll of Arc Lightning');
		expect(scroll.type).toBe('object');
		expect(scroll.img).toBe('icons/sundries/scrolls/scroll-bound-black-tan.webp');
	});

	it('creates a single-quantity identified consumable', () => {
		const system = scrollSystem(
			createScrollFromSpell(createSpell(), { includeSpellDescription: true }),
		);

		expect(system.objectType).toBe('consumable');
		expect(system.quantity).toBe(1);
		expect(system.identified).toBe(true);
	});

	it('marks the scroll as small so scrolls share a single inventory slot', () => {
		const system = scrollSystem(
			createScrollFromSpell(createSpell(), { includeSpellDescription: true }),
		);

		expect(system.objectSizeType).toBe('smallSized');
		expect(system.slotsRequired).toBe(0);
	});

	describe('pricing', () => {
		it.each([
			[0, 10],
			[1, 35],
			[2, 100],
			[3, 300],
			[4, 1000],
			[5, 3000],
			[6, 10000],
			[7, 25000],
			[8, 75000],
			[9, 200000],
		])('prices a tier %i spell at %i gp', (tier, expected) => {
			const spell = createSpell({
				system: { school: 'fire', tier, description: { baseEffect: '' }, activation: {} },
			});

			const { price } = scrollSystem(
				createScrollFromSpell(spell, { includeSpellDescription: true }),
			);

			expect(price.value).toBe(expected);
			expect(price.denomination).toBe('gp');
		});

		it('prices a utility spell as a cantrip, since utility spells are tier 0', () => {
			const utilitySpell = createSpell({
				name: 'Firebrand',
				system: { school: 'fire', tier: 0, description: { baseEffect: '' }, activation: {} },
			});

			const { price } = scrollSystem(
				createScrollFromSpell(utilitySpell, { includeSpellDescription: true }),
			);

			expect(price.value).toBe(10);
		});

		it('falls back to the cantrip price for an out-of-range tier', () => {
			const spell = createSpell({
				system: { school: 'fire', tier: 42, description: { baseEffect: '' }, activation: {} },
			});

			const { price } = scrollSystem(
				createScrollFromSpell(spell, { includeSpellDescription: true }),
			);

			expect(price.value).toBe(10);
		});
	});

	describe('description composition', () => {
		it('always writes the scroll rules', () => {
			const system = scrollSystem(
				createScrollFromSpell(createSpell(), { includeSpellDescription: false }),
			);

			expect(system.description.public).toContain('Single use.');
			expect(system.description.public).toContain('No mana cost.');
			expect(system.description.public).toContain('No magical ability needed');
			expect(system.description.public).toContain('No upcasting');
			expect(system.description.public).toContain('DC 10 Arcana check');
		});

		it("appends the spell's base effect when the setting is on", () => {
			const system = scrollSystem(
				createScrollFromSpell(createSpell(), { includeSpellDescription: true }),
			);

			expect(system.description.public).toContain('A bolt leaps to the nearest enemy.');
		});

		it("omits the spell's base effect when the setting is off", () => {
			const system = scrollSystem(
				createScrollFromSpell(createSpell(), { includeSpellDescription: false }),
			);

			expect(system.description.public).not.toContain('A bolt leaps to the nearest enemy.');
		});

		it('does not leave a trailing separator when the spell has no description', () => {
			const spell = createSpell({
				system: { school: 'fire', tier: 1, description: { baseEffect: '' }, activation: {} },
			});

			const system = scrollSystem(createScrollFromSpell(spell, { includeSpellDescription: true }));

			expect(system.description.public).not.toContain('<hr>');
		});
	});

	describe('activation', () => {
		it("copies the spell's activation so the scroll casts it", () => {
			const system = scrollSystem(
				createScrollFromSpell(createSpell(), { includeSpellDescription: true }),
			);

			expect(system.activation).toEqual({ cost: { quantity: 2, type: 'action' } });
		});

		it("does not share the spell's activation object", () => {
			const spell = createSpell();
			const system = scrollSystem(createScrollFromSpell(spell, { includeSpellDescription: true }));

			(system.activation.cost as { quantity: number }).quantity = 99;

			expect((spell.system?.activation?.cost as { quantity: number } | undefined)?.quantity).toBe(
				2,
			);
		});
	});

	describe('flags', () => {
		it('records the source spell, school and tier', () => {
			const flags = scrollFlags(
				createScrollFromSpell(createSpell(), { includeSpellDescription: true }),
			);

			expect(flags).toEqual({
				spellUuid: 'Compendium.nimble.nimble-spells.Item.arcLightning',
				school: 'lightning',
				tier: 1,
			});
		});

		it('pins the tier so the scroll can never be upcast past it', () => {
			const spell = createSpell({
				system: { school: 'ice', tier: 3, description: { baseEffect: '' }, activation: {} },
			});

			expect(
				scrollFlags(createScrollFromSpell(spell, { includeSpellDescription: true })).tier,
			).toBe(3);
		});
	});

	it('falls back when the name is explicitly null, not just absent', () => {
		const scroll = createScrollFromSpell(createSpell({ name: null }), {
			includeSpellDescription: true,
		});

		expect(scroll.name).toBe('Scroll of Unknown Spell');
	});

	it('omits the separator when the spell carries no description object at all', () => {
		const spell = createSpell({ system: { school: 'fire', tier: 1, activation: {} } });

		const system = scrollSystem(createScrollFromSpell(spell, { includeSpellDescription: true }));

		expect(system.description.public).toContain('Single use.');
		expect(system.description.public).not.toContain('<hr>');
	});

	it('falls back to the cantrip price for a negative tier', () => {
		const spell = createSpell({
			system: { school: 'fire', tier: -1, description: { baseEffect: '' }, activation: {} },
		});

		expect(
			scrollSystem(createScrollFromSpell(spell, { includeSpellDescription: true })).price.value,
		).toBe(10);
	});

	it('tolerates a spell missing every optional field but its school', () => {
		const scroll = createScrollFromSpell(
			{ system: { school: 'fire' } },
			{ includeSpellDescription: true },
		);
		const system = scrollSystem(scroll);

		expect(scroll.name).toBe('Scroll of Unknown Spell');
		expect(system.price.value).toBe(10);
		expect(scrollFlags(scroll)).toEqual({ spellUuid: '', school: 'fire', tier: 0 });
	});

	describe('school', () => {
		// The school decides whether the Arcana check applies, and every spell has
		// one, so a spell without it is broken data rather than a scroll to create.
		it('refuses to inscribe a spell with no school', () => {
			const spell = createSpell({ system: { school: '', tier: 1, activation: {} } });

			expect(() => createScrollFromSpell(spell, { includeSpellDescription: true })).toThrow(
				/Arc Lightning/,
			);
		});

		it('refuses to inscribe a spell with no system data at all', () => {
			expect(() => createScrollFromSpell({}, { includeSpellDescription: true })).toThrow(
				/no school/,
			);
		});
	});

	describe('properties', () => {
		it('carries concentration onto the scroll', () => {
			const spell = createSpell({
				system: { school: 'fire', tier: 1, properties: { selected: ['concentration'] } },
			});

			expect(
				scrollProperties(createScrollFromSpell(spell, { includeSpellDescription: true })),
			).toEqual(['concentration']);
		});

		// `range` and `reach` exist on both models but mean weapon reach on an
		// object, and `ObjectDataModel` has no option for the spell-list flags.
		it('leaves behind the properties that do not mean the same thing on an object', () => {
			const spell = createSpell({
				system: {
					school: 'fire',
					tier: 1,
					properties: {
						selected: ['concentration', 'range', 'reach', 'secretSpell', 'utilitySpell'],
					},
				},
			});

			expect(
				scrollProperties(createScrollFromSpell(spell, { includeSpellDescription: true })),
			).toEqual(['concentration']);
		});

		it('writes an empty selection for a spell with no properties', () => {
			expect(
				scrollProperties(createScrollFromSpell(createSpell(), { includeSpellDescription: true })),
			).toEqual([]);
		});
	});
});

describe('getSpellScrollData', () => {
	function scrollItem(spellScroll: unknown, type = 'object') {
		return { type, flags: { [SYSTEM_ID]: { spellScroll } } };
	}

	it('reads back what createScrollFromSpell wrote', () => {
		const scroll = createScrollFromSpell(createSpell(), { includeSpellDescription: true });

		expect(getSpellScrollData(scroll as Parameters<typeof getSpellScrollData>[0])).toEqual({
			spellUuid: 'Compendium.nimble.nimble-spells.Item.arcLightning',
			school: 'lightning',
			tier: 1,
		});
	});

	it('accepts tier 0, which is valid despite being falsy', () => {
		const data = getSpellScrollData(scrollItem({ spellUuid: '', school: 'fire', tier: 0 }));

		expect(data).toEqual({ spellUuid: '', school: 'fire', tier: 0 });
	});

	it('coerces a non-string spellUuid to an empty string', () => {
		const data = getSpellScrollData(scrollItem({ spellUuid: 42, school: 'fire', tier: 1 }));

		expect(data?.spellUuid).toBe('');
	});

	it('returns null for a non-object item', () => {
		expect(getSpellScrollData(scrollItem({ school: 'fire', tier: 1 }, 'spell'))).toBeNull();
	});

	it('returns null for an item with no flags property at all', () => {
		expect(getSpellScrollData({ type: 'object' })).toBeNull();
	});

	it('returns null when there is no flag scope at all', () => {
		expect(getSpellScrollData({ type: 'object', flags: {} })).toBeNull();
	});

	it('returns null for a flag written under a foreign scope key', () => {
		const item = {
			type: 'object',
			flags: { someOtherSystem: { spellScroll: { school: 'fire', tier: 1 } } },
		};

		expect(getSpellScrollData(item)).toBeNull();
	});

	it('returns null when the tier is missing or not a number', () => {
		expect(getSpellScrollData(scrollItem({ school: 'fire' }))).toBeNull();
		expect(getSpellScrollData(scrollItem({ school: 'fire', tier: '1' }))).toBeNull();
	});

	it('returns null when the school is missing', () => {
		expect(getSpellScrollData(scrollItem({ tier: 1 }))).toBeNull();
	});
});
