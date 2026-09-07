import { describe, expect, it, vi } from 'vitest';
import { NimbleCharacter } from './character.js';

interface GrantItem {
	type: string;
	rules: Map<string, unknown>;
}

interface ActorStub {
	system: {
		_source: { resources: { highestUnlockedSpellTier: number | null } };
		resources: { highestUnlockedSpellTier: number | null; mana: Record<string, number> };
		[key: string]: unknown;
	};
	items: { contents: GrantItem[] };
	[key: string]: unknown;
}

/** A class item with one level-gated spell grant that the rules engine accepts. */
function makeGrantItem(tier: number): GrantItem {
	const rule = {
		type: 'grantSpells',
		disabled: false,
		tiers: [tier],
		predicate: { level: { min: 1 } },
		appliesTo: () => true,
	};

	return { type: 'class', rules: new Map([['0', rule]]) };
}

/**
 * Only the fields `prepareDerivedData` touches. Sibling derivations that do not
 * feed the spell tier are stubbed out so the test isolates the override logic.
 */
function makeStub(storedTier: number | null, items: GrantItem[]): ActorStub {
	return {
		system: {
			_source: { resources: { highestUnlockedSpellTier: storedTier } },
			abilities: { strength: { mod: 0 }, dexterity: { mod: 0 } },
			attributes: {
				armor: { components: [] },
				initiative: { defaultRollMode: 0, mod: 0 },
				wounds: { bonus: 0, max: 0 },
				hitDice: {},
			},
			// Prepared data starts as a copy of the source, so the prepared value
			// begins equal to the stored one, just as it does on a real actor.
			resources: { mana: { current: 0, value: 0, max: 0 }, highestUnlockedSpellTier: storedTier },
			inventory: { bonusSlots: 0, totalSlots: 0, usedSlots: 0 },
		},
		items: { contents: items },
		classes: {},
		rules: [],
		tags: new Set<string>(),
		_prepareEarlyDerivedData: vi.fn(),
		_populateDerivedTags: vi.fn(),
		_prepareAbilitySaveAndSkillModifiers: vi.fn(),
		prepareClassData: vi.fn(),
		_prepareMaxMana: vi.fn(() => 0),
		getUsedInventorySlots: vi.fn(() => 0),
		_prepareHighestUnlockedSpellTier: NimbleCharacter.prototype._prepareHighestUnlockedSpellTier,
	};
}

function runPrepareDerivedData(stub: ActorStub): number | null {
	NimbleCharacter.prototype.prepareDerivedData.call(stub as unknown as NimbleCharacter);
	return stub.system.resources.highestUnlockedSpellTier;
}

describe('prepareDerivedData: highest unlocked spell tier', () => {
	it('uses a stored number as a manual override instead of deriving', () => {
		const stub = makeStub(4, [makeGrantItem(2)]);

		expect(runPrepareDerivedData(stub)).toBe(4);
	});

	it('treats a stored zero as an override, not as a request to derive', () => {
		const stub = makeStub(0, [makeGrantItem(2)]);

		expect(runPrepareDerivedData(stub)).toBe(0);
	});

	it('derives the tier from spell grants when the stored value is null', () => {
		const stub = makeStub(null, [makeGrantItem(2)]);

		expect(runPrepareDerivedData(stub)).toBe(2);
	});

	it('re-derives on a later prepare cycle when the grants have changed', () => {
		const stub = makeStub(null, [makeGrantItem(2)]);
		expect(runPrepareDerivedData(stub)).toBe(2);

		// Same system object as the first cycle: a derivation that read its own
		// prepared value back would keep the 2 here.
		stub.items.contents = [makeGrantItem(3)];
		expect(runPrepareDerivedData(stub)).toBe(3);

		stub.items.contents = [];
		expect(runPrepareDerivedData(stub)).toBe(0);
	});
});
