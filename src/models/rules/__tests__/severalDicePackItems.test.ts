import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { applyUpcastDeltas } from '../../../utils/spell/applyUpcastDeltas.js';
import { ChangeDieRule } from '../changeDie.js';
import { RerollRule } from '../reroll.js';

const ELEMENTAL_DESTRUCTION =
	'packs/classFeatures/core/mage/spellshaper/elemental-destruction.json';
const SHATTER = 'packs/spells/core/ice/shatter.json';

const readItem = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));

function liveRule<T>(
	RuleClass: new (...args: never[]) => T,
	data: Record<string, unknown>,
	itemUuid = 'Actor.hero.Item.pack',
): T {
	const actor = {
		uuid: 'Actor.hero',
		system: { resources: { mana: { current: 5 } } },
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		getRollData: () => ({ will: 3 }),
		items: [],
		rules: [],
	};
	const parent = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: itemUuid,
		getDomain: () => new Set<string>(),
	};
	const rule = new RuleClass({ type: data.type } as never, { parent, strict: false } as never);
	Object.assign(rule as object, { ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Elemental Destruction', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const rule = () => liveRule(RerollRule, readItem(ELEMENTAL_DESTRUCTION).system.rules[0]);
	const attackWith = (type: string) => {
		vi.stubGlobal('fromUuidSync', () => ({ type }));
		return {
			side: 'roller' as const,
			other: null,
			roll: { kind: 'attack' as const, delivery: null, itemUuid: 'Actor.hero.Item.used' },
		};
	};

	it('rerolls up to WIL picked dice, at 1 mana per die', () => {
		expect(rule().die).toBe('pickedDie');
		expect(rule().maxDice).toBe('@will');
		expect(rule().rollUseCost).toMatchObject({ manaCost: 1, perDie: true });
		expect(rule().outcome).toBe('hit');
	});

	it('is for a spell, not a weapon', () => {
		expect(rule().offersUseOn(attackWith('weapon'))).toBe(false);
		expect(rule().offersUseOn(attackWith('spell'))).toBe(true);
	});
});

describe('Shatter', () => {
	const rule = (itemUuid?: string) =>
		liveRule(
			ChangeDieRule,
			readItem(SHATTER).system.rules.find((each: { type: string }) => each.type === 'changeDie'),
			itemUuid,
		);
	const roll = (upcastSteps: number, itemUuid = 'Actor.hero.Item.pack') => ({
		side: 'roller' as const,
		other: null,
		roll: { kind: 'attack' as const, delivery: null, itemUuid, upcastSteps },
	});

	it('gives one +1 row per upcast step, with none at no upcast', () => {
		expect(rule().dieChange).toEqual({ mode: 'add', value: 1 });
		expect(rule().rowsOn(roll(2))).toBe(2);
		expect(rule().offersUseOn(roll(0))).toBe(false);
		expect(rule().offersUseOn(roll(1))).toBe(true);
	});

	it('gives no row on the attack of another item', () => {
		expect(rule().offersUseOn(roll(1, 'Actor.hero.Item.other'))).toBe(false);
	});

	it('adds +5 to the crit damage per upcast step', () => {
		const item = readItem(SHATTER);
		const { activationData } = applyUpcastDeltas({
			spell: { tier: item.system.tier, scaling: item.system.scaling },
			actor: { resources: { mana: { current: 9 }, highestUnlockedSpellTier: 9 } },
			activationData: item.system.activation,
			manaToSpend: item.system.tier + 2,
		});
		const [damage] = activationData.effects as unknown as Array<{
			formula: string;
			on: { criticalHit: Array<{ formula: string }> };
		}>;

		expect(damage.formula).toBe('3d6');
		expect(damage.on.criticalHit[0].formula).toBe('20+10');
	});
});
