import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const applyAttackerEffects = vi.fn(async (..._args: unknown[]) => undefined);
const payCost = vi.fn(async () => true);
vi.resetModules();
vi.doMock('#utils/defend/defendRequests.js', () => ({ applyAttackerEffects }));
vi.doMock('#utils/cost/costLedger.js', () => ({ payCost }));
vi.doMock('#utils/chat/cardOperations.js', () => ({
	mayActFor: () => true,
	rejectCardRequest: vi.fn(),
}));
const { CardDamageBack } = await import('../cardDamageBack.js');
type Record = import('../cardDamageBack.js').DamageBackRecord;

const globals = globalThis as unknown as { [key: string]: any };

const smoldering = { name: 'Smoldering', transfer: false };
const spell = {
	uuid: 'Item.flame',
	name: 'Flame Barrier',
	effects: new Map([['smolder', smoldering]]),
};

function rule(fields: { [key: string]: unknown } = {}) {
	const filter = (fields.attackDelivery as string) ?? 'melee';
	return {
		id: String(fields.id ?? 'r1'),
		type: 'damageBack',
		label: 'Flame Barrier',
		parentDocument: { id: 'eFlame', uuid: 'Actor.mira.ActiveEffect.eFlame', name: 'Flame Barrier' },
		item: spell,
		amount: 'formula',
		formula: '3',
		damageType: 'fire',
		ignoreArmor: true,
		notOnAllies: true,
		attackerEffectId: 'smolder',
		answeredAttack: false,
		answersAttack: (attack: { trigger?: string; delivery?: string | null }) =>
			attack.trigger === 'attacked' && (filter === 'any' || attack.delivery === filter),
		...fields,
	};
}

const token = (disposition: number) => ({ disposition });
const mira = (rules: unknown[]) => ({
	uuid: 'Actor.mira',
	rules,
	getRollData: () => ({ key: 3 }),
});
const goblin = (name = 'Goblin', uuid = 'Actor.goblin') => ({
	uuid,
	name,
	applyDamage: vi.fn(async () => undefined),
});

function setup(
	attackers: Array<{ actor: ReturnType<typeof goblin>; delivery: string | null; token?: unknown }>,
) {
	let records: Record[] = [];
	const update = vi.fn(async (changes: { [key: string]: unknown }) => {
		records = changes['system.damageBack'] as Record[];
	});
	const damageAfterDefenses = vi.fn((_actor: unknown, amount: number) => Math.ceil(amount / 2));
	const host = {
		id: () => 'attack-card',
		attacker: () => attackers[0]?.actor ?? null,
		attackers: () =>
			attackers.map((each) => ({ ...each, token: (each.token ?? token(-1)) as never })) as never,
		records: () => records,
		update,
		damageAfterDefenses,
	};
	return {
		back: new CardDamageBack(host as never),
		update,
		written: () => records,
		damageAfterDefenses,
	};
}

let automatic = true;
let settings: unknown;
let rollTotals: number[];

beforeEach(() => {
	vi.clearAllMocks();
	automatic = true;
	settings = globals.game.settings;
	globals.game.settings = { get: () => automatic };
	rollTotals = [];
	globals.Roll = class {
		formula: string;
		total = 0;
		constructor(formula: string) {
			this.formula = formula;
		}
		async evaluate() {
			this.total = rollTotals.shift() ?? Number(this.formula);
			return this;
		}
		toJSON() {
			return { formula: this.formula, total: this.total };
		}
	};
});

afterEach(() => {
	globals.game.settings = settings;
});

const holderAt = (rules: unknown[]) => ({ actor: mira(rules), token: token(1) });

describe('Attacker Takes, when the holder is attacked', () => {
	it('rolls its formula with the roll data of the rule, so @stacks reads its effect', async () => {
		globals.Roll = class {
			total = 0;
			constructor(
				public formula: string,
				public data: { [key: string]: number } = {},
			) {}
			async evaluate() {
				this.total = Number(this.formula.replace('@stacks', String(this.data.stacks)));
				return this;
			}
			toJSON() {
				return { formula: this.formula, total: this.total };
			}
		};
		const attacker = goblin();
		const { back } = setup([{ actor: attacker, delivery: 'melee' }]);
		const stacked = rule({ formula: '@stacks', rollData: () => ({ key: 3, stacks: 4 }) });

		await back.afterAttack([holderAt([stacked])]);

		expect(attacker.applyDamage).toHaveBeenCalledWith(4);
	});

	it('deals the damage and gives the effect to each attacker, once for each rule', async () => {
		const first = goblin();
		const second = goblin('Goblin 2', 'Actor.goblin2');
		const { back, written } = setup([
			{ actor: first, delivery: 'melee' },
			{ actor: second, delivery: 'melee' },
		]);

		await back.afterAttack([holderAt([rule()])]);

		expect(first.applyDamage).toHaveBeenCalledWith(3);
		expect(second.applyDamage).toHaveBeenCalledWith(3);
		expect(applyAttackerEffects).toHaveBeenCalledWith(
			first,
			[{ itemUuid: 'Item.flame', effectId: 'smolder', name: 'Smoldering' }],
			'Actor.mira',
			undefined,
			'attack-card',
		);
		expect(written()).toHaveLength(2);
		expect(written()[0]).toMatchObject({
			label: 'Flame Barrier',
			attackerName: 'Goblin',
			amount: 3,
			dealt: true,
			ignoreArmor: true,
			effect: { name: 'Smoldering' },
		});
	});

	it('answers only the delivery of its filter', async () => {
		const ranged = goblin();
		const { back, written } = setup([{ actor: ranged, delivery: 'ranged' }]);

		await back.afterAttack([holderAt([rule()])]);

		expect(ranged.applyDamage).not.toHaveBeenCalled();
		expect(written()).toEqual([]);
	});

	it('leaves out an ally with Not on allies, and the holder itself', async () => {
		const ally = goblin('Kael', 'Actor.kael');
		const { back, written } = setup([
			{ actor: ally, delivery: 'melee', token: token(1) },
			{ actor: { ...goblin('Mira', 'Actor.mira') }, delivery: 'melee', token: token(-1) },
		]);

		await back.afterAttack([holderAt([rule()])]);
		expect(written()).toEqual([]);

		const { back: again, written: also } = setup([
			{ actor: ally, delivery: 'melee', token: token(1) },
		]);
		await again.afterAttack([holderAt([rule({ notOnAllies: false })])]);
		expect(also()).toHaveLength(1);
	});

	it('rolls a dice formula once for each record', async () => {
		const attacker = goblin();
		rollTotals = [7];
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);

		await back.afterAttack([holderAt([rule({ formula: '1d12', attackerEffectId: '' })])]);

		expect(attacker.applyDamage).toHaveBeenCalledTimes(1);
		expect(written()[0]).toMatchObject({ amount: 7, effect: null });
	});

	it("takes the attacker's armor into account when the rule does not ignore it", async () => {
		const attacker = goblin();
		const { back, written, damageAfterDefenses } = setup([{ actor: attacker, delivery: 'melee' }]);

		await back.afterAttack([holderAt([rule({ formula: '6', ignoreArmor: false })])]);

		expect(damageAfterDefenses).toHaveBeenCalledWith(attacker, 6, {
			damageType: 'fire',
			roll: { formula: '6', total: 6 },
		});
		expect(written()[0]).toMatchObject({ amount: 3, ignoreArmor: false });
	});

	it('waits for a click with Feature Effects off, and the click deals it and gives the effect', async () => {
		automatic = false;
		const attacker = goblin();
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);
		await back.afterAttack([holderAt([rule()])]);
		expect(attacker.applyDamage).not.toHaveBeenCalled();
		expect(written()[0]?.dealt).toBe(false);

		globals.game.user = { ...globals.game.user, id: 'gm', isGM: true };
		globals.fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.goblin' ? attacker : { uuid, isOwner: true },
		);
		await back.resolve(written()[0]?.id ?? '', 'deal', 'gm');

		expect(attacker.applyDamage).toHaveBeenCalledTimes(1);
		expect(applyAttackerEffects).toHaveBeenCalledTimes(1);
		expect(written()[0]?.dealt).toBe(true);
	});

	it('makes no second record when the card is read again', async () => {
		const attacker = goblin();
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);

		await back.afterAttack([holderAt([rule()])]);
		await back.afterAttack([holderAt([rule()])]);

		expect(written()).toHaveLength(1);
		expect(attacker.applyDamage).toHaveBeenCalledTimes(1);
	});

	it('reads only the rules of the effect that answers the attack', async () => {
		const attacker = goblin();
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);
		const answering = rule({ id: 'a', answeredAttack: true });
		const later = rule({ id: 'b', answeredAttack: false });
		const other = rule({
			id: 'c',
			answeredAttack: true,
			parentDocument: { id: 'eOther', uuid: 'Actor.mira.ActiveEffect.eOther' },
		});

		await back.afterAttack([holderAt([answering, later, other])], { effectId: 'eFlame' });

		expect(written().map((record) => record.key)).toEqual([
			'Actor.mira.ActiveEffect.eFlame:a:Actor.mira:Actor.goblin:attack-card',
		]);
	});

	it('makes no record for a rule of the damage taken, as no damage was taken yet', async () => {
		const attacker = goblin();
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);

		await back.afterAttack([holderAt([rule({ amount: 'taken', attackerEffectId: '' })])]);

		expect(written()).toEqual([]);
	});
});
