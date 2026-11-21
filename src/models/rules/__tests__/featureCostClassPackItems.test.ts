import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { UseOptionRule } from '../useOption.js';

type Json = Record<string, any>;

const FEATURES = 'packs/classFeatures/core';
const STORMSHIFTER = `${FEATURES}/stormshifter`;
const SHADOWMANCER = `${FEATURES}/shadowmancer/shadowmancer-subclasses`;
const SPELLS = 'packs/spells/core';

function readItem(path: string): Json {
	return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function rulesOfType(item: Json, type: string): Json[] {
	return (item.system.rules as Json[]).filter((rule) => rule.type === type);
}

/** Every field of the pack rule is a field of its rule type, so the engine reads it. */
function expectKnownFields(rule: Json): void {
	const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
	expect(ruleClass, rule.type).toBeDefined();
	const schema = ruleClass.defineSchema() as Record<string, unknown>;
	expect(Object.keys(rule).filter((key) => !(key in schema))).toEqual([]);
}

/** The one Spell or Attack Option rule of the item, as the engine reads it. */
function optionOf(item: Json): UseOptionRule & Json {
	const [data, ...more] = rulesOfType(item, 'useOption');
	expect(more).toEqual([]);
	expectKnownFields(data);
	const rule = new UseOptionRule({ type: 'useOption' } as never, { strict: false });
	Object.assign(rule, data);
	return rule as UseOptionRule & Json;
}

/** A pack spell with the identifier its owned copy has. */
function spellAt(path: string): Json {
	const spell = readItem(`${SPELLS}/${path}`);
	return { ...spell, identifier: spell.system.identifier || spell.name.slugify({ strict: true }) };
}

/** The one Spend or Sacrifice rule of the item. */
function costOf(item: Json): Json {
	const [cost, ...more] = rulesOfType(item, 'resourceCost');
	expect(more).toEqual([]);
	expectKnownFields(cost);
	return cost;
}

describe('pack text', () => {
	it.each([
		`${FEATURES}/oathsworn/oathsworn-progression/zealot.json`,
		`${FEATURES}/commander/commander-subclasses/spellblade/firebrand.json`,
		`${STORMSHIFTER}/stormshifter-subclasses/circle-of-sky-and-storm/master-of-storm.json`,
		`${STORMSHIFTER}/stormshifter-subclasses/circle-of-fang-and-claw/storm-wake.json`,
		`${STORMSHIFTER}/stormshifter-subclasses/circle-of-fang-and-claw/venomous-gaze.json`,
		`${STORMSHIFTER}/direbeast-form/beast-of-the-pack.json`,
		`${SHADOWMANCER}/pact-of-the-abyssal-depths/shadowfrost.json`,
		`${SHADOWMANCER}/pact-of-the-abyssal-depths/cryomancers-reprisal.json`,
		`${SHADOWMANCER}/pact-of-the-red-dragon/enveloped-by-the-master.json`,
	])('%s has no em-dash or middle dot', (path) => {
		expect(readFileSync(resolve(path), 'utf8')).not.toMatch(/[—·]/);
	});
});

describe('Zealot', () => {
	it('spends mana up to the highest unlocked spell tier on a melee attack, split between its two picks', () => {
		const option = optionOf(readItem(`${FEATURES}/oathsworn/oathsworn-progression/zealot.json`));

		expect(option).toMatchObject({
			target: 'meleeWeapon',
			kind: 'mana',
			spendMode: 'variable',
			min: '0',
			max: '@resources.highestUnlockedSpellTier',
			beyond: 'notAllowed',
			chargePoolIdentifier: '',
			disabled: false,
		});
		expect(option.pickList).toEqual([
			{
				key: '0',
				name: 'Condemning Strike',
				damage: '5',
				damageType: 'radiant',
				lowerArmorSteps: 0,
			},
			{ key: '1', name: 'Blessed Aim', damage: '', damageType: '', lowerArmorSteps: 1 },
		]);
	});
});

describe('Firebrand', () => {
	const item = readItem(`${FEATURES}/commander/commander-subclasses/spellblade/firebrand.json`);
	const enchantWeapon = spellAt('fire/enchant-weapon.json');

	it('gives the Commander Enchant Weapon from the spells compendium', () => {
		const [grant, ...more] = rulesOfType(item, 'grantSpells');
		expect(more).toEqual([]);
		expectKnownFields(grant);

		expect(grant).toMatchObject({
			mode: 'auto',
			disabled: false,
			uuids: [`Compendium.nimble.nimble-spells.Item.${enchantWeapon._id}`],
		});
	});

	it('casts Enchant Weapon for free when Initiative is rolled, with an upcast for the mana above its tier', () => {
		const [free, ...more] = rulesOfType(item, 'useItemFree');
		expect(more).toEqual([]);
		expectKnownFields(free);

		expect(free).toMatchObject({
			itemIdentifier: enchantWeapon.identifier,
			triggers: ['onInitiative'],
			freeOf: ['uses', 'mana'],
			upcast: true,
			disabled: false,
		});
	});
});

describe('Master of Storm', () => {
	const item = readItem(
		`${STORMSHIFTER}/stormshifter-subclasses/circle-of-sky-and-storm/master-of-storm.json`,
	);

	it('casts Ride the Lightning for 0 mana at its own tier, once each Safe Rest', () => {
		const option = optionOf(item);

		expect(option).toMatchObject({
			target: 'spell',
			kind: 'mana',
			spendMode: 'fixed',
			amount: '0',
			manaSet: 0,
			replacesSpellCost: false,
			chargePoolIdentifier: 'master-of-storm',
			disabled: false,
		});
		expect(option.appliesToSpell(spellAt('lightning/ride-the-lightning.json'))).toBe(true);
		expect(option.appliesToSpell(spellAt('lightning/arc-lightning.json'))).toBe(false);

		const [pool, ...more] = rulesOfType(item, 'chargePool');
		expect(more).toEqual([]);
		expectKnownFields(pool);
		expect(pool).toMatchObject({
			identifier: 'master-of-storm',
			label: 'Master of Storm (1/Safe Rest)',
			max: '1',
			initial: 'max',
			recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
		});
	});

	it('keeps lightning and wind concentration apart', () => {
		expect(rulesOfType(item, 'concentrationTrack')).toEqual([
			expect.objectContaining({ schools: ['lightning', 'wind'], disabled: false }),
		]);
	});
});

describe('Stormshifter costs that wait on the Direbeast forms', () => {
	it('Storm Wake spends 3 mana', () => {
		const item = readItem(
			`${STORMSHIFTER}/stormshifter-subclasses/circle-of-fang-and-claw/storm-wake.json`,
		);

		expect(costOf(item)).toMatchObject({
			kind: 'mana',
			spendMode: 'fixed',
			amount: '3',
			beyond: 'notAllowed',
			disabled: false,
		});
	});

	it('Venomous Gaze spends 2 mana', () => {
		const item = readItem(
			`${STORMSHIFTER}/stormshifter-subclasses/circle-of-fang-and-claw/venomous-gaze.json`,
		);

		expect(costOf(item)).toMatchObject({
			kind: 'mana',
			spendMode: 'fixed',
			amount: '2',
			beyond: 'notAllowed',
			disabled: false,
		});
	});

	it('Supercharge in Beast of the Pack lets the player spend 0 to WIL mana', () => {
		const item = readItem(`${STORMSHIFTER}/direbeast-form/beast-of-the-pack.json`);

		expect(costOf(item)).toMatchObject({
			kind: 'mana',
			spendMode: 'variable',
			min: '0',
			max: '@will',
			beyond: 'notAllowed',
			disabled: false,
		});
	});
});

describe('Shadowmancer costs', () => {
	it('Enveloped by the Master sacrifices 1d4 Wounds, even past what the caster has', () => {
		const item = readItem(`${SHADOWMANCER}/pact-of-the-red-dragon/enveloped-by-the-master.json`);

		expect(costOf(item)).toMatchObject({
			kind: 'wounds',
			spendMode: 'fixed',
			amount: '1d4',
			beyond: 'allowed',
			disabled: false,
		});
	});

	it('Shadowfrost spends exactly 10 temp HP in place of Pilfered Power, on Cryosleep and Rimeblades', () => {
		const option = optionOf(
			readItem(`${SHADOWMANCER}/pact-of-the-abyssal-depths/shadowfrost.json`),
		);

		expect(option).toMatchObject({
			target: 'spell',
			kind: 'tempHp',
			spendMode: 'fixed',
			amount: '10',
			beyond: 'notAllowed',
			replacesSpellCost: true,
			chargePoolIdentifier: '',
			manaSet: null,
			disabled: false,
		});
		expect(option.appliesToSpell(spellAt('ice/cryosleep.json'))).toBe(true);
		expect(option.appliesToSpell(spellAt('ice/rimeblades.json'))).toBe(true);
		expect(option.appliesToSpell(spellAt('ice/ice-lance.json'))).toBe(false);
	});

	it("Cryomancer's Reprisal sacrifices half the max HP in place of the cost of any Ice spell", () => {
		const option = optionOf(
			readItem(`${SHADOWMANCER}/pact-of-the-abyssal-depths/cryomancers-reprisal.json`),
		);

		expect(option).toMatchObject({
			target: 'spell',
			kind: 'hp',
			spendMode: 'fixed',
			amount: 'floor(@attributes.hp.max / 2)',
			beyond: 'notAllowed',
			replacesSpellCost: true,
			chargePoolIdentifier: '',
			disabled: false,
		});
		expect(option.appliesToSpell(spellAt('ice/ice-lance.json'))).toBe(true);
		expect(option.appliesToSpell(spellAt('ice/arctic-annihilation.json'))).toBe(true);
		expect(option.appliesToSpell(spellAt('fire/enchant-weapon.json'))).toBe(false);
	});

	it("Cryomancer's Reprisal gives an aura after the cast: the next melee hitter takes cold damage of half the HP sacrificed", () => {
		const item = readItem(`${SHADOWMANCER}/pact-of-the-abyssal-depths/cryomancers-reprisal.json`);
		const option = optionOf(item);
		const aura = (item.effects as Json[]).find((effect) => effect._id === option.effectId);

		expect(aura).toMatchObject({ transfer: false, disabled: false });
		expect(item.system.activation.effects).toEqual([]);
		const [rule, ...more] = aura?.system.rules as Json[];
		expect(more).toEqual([]);
		expectKnownFields(rule);
		expect(rule).toMatchObject({
			type: 'damageBack',
			disabled: false,
			trigger: 'damaged',
			attackDelivery: 'melee',
			onlyCrits: false,
			amount: 'formula',
			formula: 'floor(@cost.hp / 2)',
			damageType: 'cold',
			attackerEffectId: '',
		});
	});

	it("Cryomancer's Reprisal aura ends when its holder takes damage, or when combat ends", () => {
		const item = readItem(`${SHADOWMANCER}/pact-of-the-abyssal-depths/cryomancers-reprisal.json`);
		const aura = (item.effects as Json[]).find((effect) => effect._id === optionOf(item).effectId);

		expect(aura?.system.lastsUntil).toEqual([
			expect.objectContaining({ kind: 'event', event: 'takeDamage', who: 'holder' }),
			expect.objectContaining({ kind: 'event', event: 'combatEnd' }),
		]);
	});
});
