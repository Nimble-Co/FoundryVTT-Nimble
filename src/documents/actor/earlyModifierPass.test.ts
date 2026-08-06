import { describe, expect, it, vi } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';
import { NimbleCharacter } from './character.js';

/**
 * Rule formulas resolve against `getRollData()`, which reads ability, save and
 * skill modifiers straight off `system`. Those are derived, so a rule whose
 * `prePrepareData` runs before they are computed sees the source value — a bonus
 * written as `@strength` silently resolves to nothing. The ordering is the whole
 * contract: `_prepareEarlyDerivedData` must compute the modifiers, and the
 * `prePrepareData` sweep must run after it.
 */

const characterProto = NimbleCharacter.prototype as unknown as {
	_prepareEarlyDerivedData(): void;
	_prepareAbilitySaveAndSkillModifiers(): void;
	getRollData(): Record<string, number>;
};

/** Character-shaped source data: STR +5 from an ability score, +2 skill points in Might. */
function makeSystem() {
	return {
		abilities: {
			strength: { baseValue: 5, bonus: 0, mod: 0 },
			dexterity: { baseValue: 2, bonus: 0, mod: 0 },
			intelligence: { baseValue: -1, bonus: 0, mod: 0 },
			will: { baseValue: 3, bonus: 0, mod: 0 },
		},
		savingThrows: {
			strength: { bonus: 0, mod: 0 },
			dexterity: { bonus: 0, mod: 0 },
			intelligence: { bonus: 0, mod: 0 },
			will: { bonus: 0, mod: 0 },
		},
		skills: {
			arcana: { points: 0, bonus: 0, mod: 0, defaultRollMode: 0 },
			might: { points: 2, bonus: 0, mod: 0, defaultRollMode: 0 },
		},
	};
}

/**
 * An actor stub wired to the real methods under test. Only the parts that need a
 * live world — hit points, class bonuses, domain tags — are stood in for.
 */
function makeCharacterStub(rules: { prePrepareData(): void }[] = []) {
	const stub = {
		system: makeSystem(),
		rules,
		classes: {},
		levels: { character: 1 },
		getClassAbilityBonuses: () => ({}),
		_prepareHitPoints: vi.fn(),
		_populateDerivedTags: vi.fn(),
		_prepareEarlyDerivedData: () => characterProto._prepareEarlyDerivedData.call(stub),
		_prepareAbilitySaveAndSkillModifiers: () =>
			characterProto._prepareAbilitySaveAndSkillModifiers.call(stub),
		getRollData: () => characterProto.getRollData.call(stub),
	};

	return stub;
}

type CharacterStub = ReturnType<typeof makeCharacterStub>;

function runPrepareDerivedData(stub: CharacterStub): void {
	NimbleBaseActor.prototype.prepareDerivedData.call(
		stub as unknown as InstanceType<typeof NimbleBaseActor>,
	);
}

describe('_prepareEarlyDerivedData — modifiers available to rule formulas', () => {
	it('computes ability, save and skill modifiers', () => {
		const stub = makeCharacterStub();

		stub._prepareEarlyDerivedData();

		expect(stub.system.abilities.strength.mod).toBe(5);
		expect(stub.system.savingThrows.strength.mod).toBe(5);
		// Might keys off strength, plus its 2 skill points.
		expect(stub.system.skills.might.mod).toBe(7);
		expect(stub.system.skills.arcana.mod).toBe(-1);
	});

	it('exposes the derived modifiers to a rule reading getRollData during prePrepareData', () => {
		const seen: Record<string, number> = {};
		const rule = {
			prePrepareData() {
				const rollData = stub.getRollData();
				seen.strength = rollData.strength;
				seen.might = rollData.might;
				seen.strengthSave = rollData.strengthSave;
			},
		};
		const stub = makeCharacterStub([rule]);

		runPrepareDerivedData(stub);

		// Source values are all 0; anything else proves the early pass ran first.
		expect(seen.strength).toBe(5);
		expect(seen.might).toBe(7);
		expect(seen.strengthSave).toBe(5);
	});

	it('runs the early pass before the prePrepareData sweep', () => {
		const order: string[] = [];
		const rule = { prePrepareData: () => order.push('prePrepareData') };
		const stub = makeCharacterStub([rule]);
		const early = stub._prepareEarlyDerivedData;
		stub._prepareEarlyDerivedData = () => {
			order.push('early');
			early();
		};

		runPrepareDerivedData(stub);

		expect(order).toEqual(['early', 'prePrepareData']);
	});
});
