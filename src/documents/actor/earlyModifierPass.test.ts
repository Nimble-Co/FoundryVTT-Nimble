import { describe, expect, it, vi } from 'vitest';
import { MaxHpBonusRule } from '../../models/rules/maxHpBonus.js';
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
	_prepareHitPoints(system: unknown): void;
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

/**
 * `_prepareHitPoints` is where a maxHpBonus rule actually reaches max HP. It
 * runs in the early pass, before `_populateDerivedTags`, because `hp.max` is
 * what the HP-derived tags are computed from.
 */
function makeHitPointStub(
	options: { level?: number; classes?: Record<string, { maxHp: number }>; bonus?: number } = {},
) {
	const { level = 1, classes = { fighter: { maxHp: 20 } }, bonus = 0 } = options;

	const stub = {
		system: { attributes: { hp: { max: 0, bonus } } },
		rules: [] as unknown[],
		classes,
		levels: { character: level },
		getRollData: () => ({ level: stub.levels.character }),
		getDomain: () => new Set<string>(),
		prepareHitPoints: () => characterProto._prepareHitPoints.call(stub, stub.system),
	};

	return stub;
}

/** A real MaxHpBonusRule bound to the stub, so the reduction runs against live code. */
function attachMaxHpBonus(
	stub: ReturnType<typeof makeHitPointStub>,
	value: number,
	perLevel = false,
) {
	const item = {
		isEmbedded: true,
		actor: stub,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: () => new Set<string>(),
	};

	const rule = new MaxHpBonusRule({ type: 'maxHpBonus' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});

	// The DataModel mock skips schema initialization, so assign the source values.
	Object.assign(rule, { type: 'maxHpBonus', value, perLevel, disabled: false });
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => stub, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });

	stub.rules.push(rule);
	return rule;
}

describe('_prepareHitPoints — maxHpBonus reaches max HP', () => {
	it('adds a flat rule bonus on top of the class total and the manual bonus', () => {
		const stub = makeHitPointStub({ bonus: 3 });
		attachMaxHpBonus(stub, 5);

		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.max).toBe(28);
	});

	it('counts only maxHpBonus rules', () => {
		const stub = makeHitPointStub();
		attachMaxHpBonus(stub, 5);
		stub.rules.push(
			{ type: 'maxWounds', resolvedBonus: () => 100 },
			{ type: 'armorClass' },
			{ type: 'speedBonus', resolvedBonus: () => 100 },
		);

		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.max).toBe(25);
	});

	it('rescales a perLevel rule when the character level rises', () => {
		const stub = makeHitPointStub({ level: 1 });
		attachMaxHpBonus(stub, 2, true);

		stub.prepareHitPoints();
		expect(stub.system.attributes.hp.max).toBe(22);

		// The #499 case: nothing about the rule changes, only the actor's level.
		stub.levels.character = 5;
		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.max).toBe(30);
	});

	it('sums every maxHpBonus rule the actor carries', () => {
		const stub = makeHitPointStub();
		attachMaxHpBonus(stub, 5);
		attachMaxHpBonus(stub, 10);

		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.max).toBe(35);
	});

	it('leaves max HP alone for a classless actor', () => {
		const stub = makeHitPointStub({ classes: {} });
		attachMaxHpBonus(stub, 5);

		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.max).toBe(0);
	});

	it('never writes the rule contribution back into the stored bonus', () => {
		const stub = makeHitPointStub({ bonus: 3 });
		attachMaxHpBonus(stub, 5, true);

		stub.prepareHitPoints();
		stub.prepareHitPoints();

		expect(stub.system.attributes.hp.bonus).toBe(3);
	});
});
