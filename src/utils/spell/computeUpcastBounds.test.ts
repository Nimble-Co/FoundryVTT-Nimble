import { describe, expect, it } from 'vitest';
import { computeUpcastBounds } from './computeUpcastBounds.js';

describe('computeUpcastBounds', () => {
	it('clamps the slider to the mana on hand when resource spending is automated', () => {
		const bounds = computeUpcastBounds({
			spellTier: 1,
			resources: { mana: { current: 2 }, highestUnlockedSpellTier: 5 },
			enforceManaCost: true,
		});

		expect(bounds).toEqual({ currentMana: 2, maxTier: 5, maxMana: 2 });
	});

	it('ignores mana but keeps the tier ladder when resource spending is manual', () => {
		const bounds = computeUpcastBounds({
			spellTier: 1,
			resources: { mana: { current: 2 }, highestUnlockedSpellTier: 5 },
			enforceManaCost: false,
		});

		expect(bounds).toEqual({ currentMana: 2, maxTier: 5, maxMana: 5 });
	});

	it('never offers more than the ladder even with mana to spare', () => {
		const bounds = computeUpcastBounds({
			spellTier: 2,
			resources: { mana: { current: 12 }, highestUnlockedSpellTier: 4 },
			enforceManaCost: true,
		});

		expect(bounds.maxMana).toBe(4);
	});

	it.each([
		['no resources node', undefined],
		['a null resources node', null],
	])('casts at the spell tier for an actor with %s', (_label, resources) => {
		const bounds = computeUpcastBounds({ spellTier: 3, resources, enforceManaCost: false });

		expect(bounds).toEqual({ currentMana: 0, maxTier: 3, maxMana: 3 });
	});

	it('casts at the spell tier when the ladder is unset on an actor with resources', () => {
		const bounds = computeUpcastBounds({
			spellTier: 3,
			resources: { mana: { current: 10 }, highestUnlockedSpellTier: null },
			enforceManaCost: false,
		});

		expect(bounds.maxTier).toBe(3);
		expect(bounds.maxMana).toBe(3);
	});

	it('leaves a cantrip at tier 0 when the actor has no ladder', () => {
		const bounds = computeUpcastBounds({
			spellTier: 0,
			resources: undefined,
			enforceManaCost: true,
		});

		expect(bounds).toEqual({ currentMana: 0, maxTier: 0, maxMana: 0 });
	});

	it('bounds a cantrip by the ladder like any other spell', () => {
		const bounds = computeUpcastBounds({
			spellTier: 0,
			resources: { mana: { current: 4 }, highestUnlockedSpellTier: 2 },
			enforceManaCost: true,
		});

		expect(bounds).toEqual({ currentMana: 4, maxTier: 2, maxMana: 2 });
	});
});
