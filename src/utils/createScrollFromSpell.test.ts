import { describe, expect, it } from 'vitest';

import { SYSTEM_ID } from '#system';

import createScrollFromSpell, {
	type ScrollSourceSpell,
	SPELL_SCROLL_IMG,
	SPELL_SCROLL_PRICE_BY_TIER,
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
		description: { public: string };
		objectType: string;
		objectSizeType: string;
		slotsRequired: number;
		quantity: number;
		identified: boolean;
		price: { value: number; denomination: string };
	};
}

describe('createScrollFromSpell', () => {
	it('names the scroll after the inscribed spell', () => {
		const scroll = createScrollFromSpell(createSpell(), { includeSpellDescription: true });

		expect(scroll.name).toBe('Scroll of Arc Lightning');
		expect(scroll.type).toBe('object');
		expect(scroll.img).toBe(SPELL_SCROLL_IMG);
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

			expect(price.value).toBe(SPELL_SCROLL_PRICE_BY_TIER[0]);
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
			expect(system.description.public).toContain('Cannot be upcast');
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

	it('tolerates a spell missing every optional field', () => {
		const scroll = createScrollFromSpell({}, { includeSpellDescription: true });
		const system = scrollSystem(scroll);

		expect(scroll.name).toBe('Scroll of Unknown Spell');
		expect(system.price.value).toBe(10);
		expect(scrollFlags(scroll)).toEqual({ spellUuid: '', school: '', tier: 0 });
	});
});
