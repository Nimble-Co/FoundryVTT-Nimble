import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const applyAttackerEffects = vi.fn(async (..._args: unknown[]) => undefined);
vi.resetModules();
vi.doMock('#utils/defend/defendRequests.js', () => ({ applyAttackerEffects }));
vi.doMock('#utils/cost/costLedger.js', () => ({ payCost: vi.fn(async () => true) }));
vi.doMock('#utils/chat/cardOperations.js', () => ({
	mayActFor: () => true,
	rejectCardRequest: vi.fn(),
}));
const { CardDamageBack } = await import('../cardDamageBack.js');
type Record = import('../cardDamageBack.js').DamageBackRecord;

const globals = globalThis as unknown as { [key: string]: any };

function rule(fields: { [key: string]: unknown } = {}) {
	const filter = (fields.attackDelivery as string) ?? 'any';
	return {
		id: String(fields.id ?? 'haha'),
		type: 'damageBack',
		label: 'Haha, Missed Me!',
		parentDocument: { id: 'feature', uuid: 'Actor.goblin.Item.haha', name: 'Haha, Missed Me!' },
		amount: 'formula',
		formula: '1',
		rollData: () => ({}),
		damageType: 'psychic',
		ignoreArmor: true,
		notOnAllies: false,
		answersAttack: (attack: { trigger?: string; delivery?: string | null }) =>
			attack.trigger === 'missed' && (filter === 'any' || attack.delivery === filter),
		...fields,
	};
}

const token = (disposition: number) => ({ disposition });
const goblin = {
	uuid: 'Actor.goblin',
	name: 'Goblin',
	rules: [] as unknown[],
};
const hero = () => ({
	uuid: 'Actor.hero',
	name: 'Hero',
	applyDamage: vi.fn(async () => undefined),
});

function setup(delivery: string | null = 'melee', attackerToken = token(-1)) {
	let records: Record[] = [];
	const attacker = hero();
	const update = vi.fn(async (changes: { [key: string]: unknown }) => {
		records = changes['system.damageBack'] as Record[];
	});
	const host = {
		id: () => 'attack-card',
		attacker: () => attacker,
		attackers: () => [{ actor: attacker, token: attackerToken, delivery }],
		records: () => records,
		update,
	};
	return { back: new CardDamageBack(host as never), attacker, update, written: () => records };
}

let automatic = true;
let settings: unknown;

beforeEach(() => {
	vi.clearAllMocks();
	automatic = true;
	settings = globals.game.settings;
	globals.game.settings = { get: () => automatic };
	globals.Roll = class {
		formula: string;
		total = 0;
		constructor(formula: string) {
			this.formula = formula;
		}
		async evaluate() {
			this.total = Number(this.formula);
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

const holder = (rules: unknown[], disposition = 1) => ({
	actor: { ...goblin, rules },
	token: token(disposition),
});

describe('Attacker Takes, when an attack misses the owner', () => {
	it('records 1 psychic damage on the card for the attacker', async () => {
		const { back, attacker, written } = setup();

		await back.afterMiss([holder([rule()])]);

		expect(written()).toEqual([
			expect.objectContaining({
				label: 'Haha, Missed Me!',
				actorUuid: 'Actor.goblin',
				attackerUuid: 'Actor.hero',
				amount: 1,
				damageType: 'psychic',
				ignoreArmor: true,
				dealt: true,
			}),
		]);
		expect(attacker.applyDamage).toHaveBeenCalledWith(1);
	});

	it('does not record that rule when the card is only an attack', async () => {
		const { back, update } = setup();

		await back.afterAttack([holder([rule()])]);

		expect(update).not.toHaveBeenCalled();
	});

	it('does not record damage taken or crit dice, because a miss dealt none', async () => {
		const { back, update } = setup();
		const taken = rule({ amount: 'taken', formula: '' });
		const critDice = rule({ id: 'crits', amount: 'critDice', formula: '' });

		await back.afterMiss([holder([taken, critDice])]);

		expect(update).not.toHaveBeenCalled();
	});

	it('does not add a second record for the same rule', async () => {
		const { back, written } = setup();
		const rules = [rule()];

		await back.afterMiss([holder(rules)]);
		await back.afterMiss([holder(rules)]);

		expect(written()).toHaveLength(1);
	});

	it('skips an ally when the rule says not on allies', async () => {
		const { back, update } = setup('melee', token(1));

		await back.afterMiss([holder([rule({ notOnAllies: true })], 1)]);

		expect(update).not.toHaveBeenCalled();
	});

	it('skips a delivery the rule does not answer', async () => {
		const { back, update } = setup('ranged');

		await back.afterMiss([holder([rule({ attackDelivery: 'melee' })])]);

		expect(update).not.toHaveBeenCalled();
	});

	it('leaves the line on the card when Feature Effects are off', async () => {
		automatic = false;
		const { back, attacker, written } = setup();

		await back.afterMiss([holder([rule()])]);

		expect(written()[0]).toMatchObject({ amount: 1, dealt: false });
		expect(attacker.applyDamage).not.toHaveBeenCalled();
	});
});
