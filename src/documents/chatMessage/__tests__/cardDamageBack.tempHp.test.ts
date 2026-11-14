import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const applyAttackerEffects = vi.fn(async (..._args: unknown[]) => undefined);
vi.resetModules();
vi.doMock('#utils/defend/defendRequests.js', () => ({ applyAttackerEffects }));
const { CardDamageBack } = await import('../cardDamageBack.js');
type DamageBackRecord = import('../cardDamageBack.js').DamageBackRecord;

const globals = globalThis as unknown as { [key: string]: any };

const halved = { name: 'Crystalline Armor', transfer: false };
const commander = {
	uuid: 'Item.hold',
	name: 'Hold the Line!',
	effects: new Map([['slow', halved]]),
};

/** A rule on an effect that owns `owned` temp HP. */
function rule(owned: number | null, fields: { [key: string]: unknown } = {}) {
	return {
		id: 'r1',
		type: 'damageBack',
		label: 'Hold the Line!',
		parentDocument: {
			id: 'eHold',
			uuid: 'Actor.ally.ActiveEffect.eHold',
			system: { tempHp: owned },
		},
		item: commander,
		amount: 'none',
		notOnAllies: true,
		attackerEffectId: 'slow',
		answersAttack: (attack: { trigger?: string; delivery?: string | null }) =>
			attack.trigger === 'tempHpReduced' && attack.delivery === 'melee',
		...fields,
	};
}

const ally = (temp: number, rules: unknown[]) => ({
	uuid: 'Actor.ally',
	rules,
	system: { attributes: { hp: { temp } } },
});
const goblin = (uuid = 'Actor.goblin', name = 'Goblin') => ({
	uuid,
	name,
	applyDamage: vi.fn(async () => undefined),
});

type Attacker = {
	actor: ReturnType<typeof goblin>;
	delivery: string;
	hit?: boolean;
	token?: unknown;
};

function setup(attackers: Attacker[]) {
	let records: DamageBackRecord[] = [];
	const host = {
		id: () => 'attack-card',
		attacker: () => attackers[0]?.actor ?? null,
		attackers: () => attackers.map((each) => ({ token: { disposition: -1 }, ...each })) as never,
		records: () => records,
		update: vi.fn(async (changes: { [key: string]: unknown }) => {
			records = changes['system.damageBack'] as DamageBackRecord[];
		}),
	};
	return { back: new CardDamageBack(host as never), written: () => records };
}

/** The card's damage: the rules are read, the hit lands, then the damage back is read. */
async function hit(
	back: InstanceType<typeof CardDamageBack>,
	holder: ReturnType<typeof ally>,
	tempAfter: number,
) {
	const tempHp = back.beforeDamage(holder, { isCritical: false });
	holder.system.attributes.hp.temp = tempAfter;
	// The active GM ends the link when the temp HP are gone.
	if (tempAfter <= 0)
		(holder.rules[0] as ReturnType<typeof rule>).parentDocument.system.tempHp = null;
	await back.afterDamage([{ actor: holder, taken: 6, token: { disposition: 1 }, tempHp }], {
		isCritical: false,
	});
}

let settings: unknown;

beforeEach(() => {
	vi.clearAllMocks();
	settings = globals.game.settings;
	globals.game.settings = { get: () => true };
});

afterEach(() => {
	globals.game.settings = settings;
});

describe('Attacker Takes, when the attack takes the temp HP of the effect', () => {
	it('gives the effect to the melee attacker that reduced the temp HP', async () => {
		const attacker = goblin();
		const { back, written } = setup([{ actor: attacker, delivery: 'melee' }]);

		await hit(back, ally(15, [rule(15)]), 9);

		expect(applyAttackerEffects).toHaveBeenCalledWith(
			attacker,
			[{ itemUuid: 'Item.hold', effectId: 'slow', name: 'Crystalline Armor' }],
			'Actor.ally',
			undefined,
			'attack-card',
		);
		expect(attacker.applyDamage).not.toHaveBeenCalled();
		expect(written()).toEqual([
			expect.objectContaining({ label: 'Hold the Line!', amount: 0, dealt: true }),
		]);
	});

	it('still counts the hit that takes the temp HP to 0, as the rules were read before it', async () => {
		const { back, written } = setup([{ actor: goblin(), delivery: 'melee' }]);

		await hit(back, ally(15, [rule(15)]), 0);

		expect(written()).toHaveLength(1);
	});

	it('gives nothing when the effect owns no temp HP, or the temp HP did not go down', async () => {
		const { back, written } = setup([{ actor: goblin(), delivery: 'melee' }]);

		await hit(back, ally(5, [rule(null)]), 0);
		await hit(back, ally(15, [rule(15)]), 15);

		expect(written()).toEqual([]);
	});

	it('gives nothing to a ranged attacker or an ally', async () => {
		const { back, written } = setup([
			{ actor: goblin(), delivery: 'ranged' },
			{ actor: goblin('Actor.kael', 'Kael'), delivery: 'melee', token: { disposition: 1 } },
		]);

		await hit(back, ally(15, [rule(15)]), 9);

		expect(written()).toEqual([]);
	});

	it('gives each member of a minion group that hit its own line', async () => {
		const { back, written } = setup([
			{ actor: goblin('Actor.g1', 'Goblin 1'), delivery: 'melee', hit: true },
			{ actor: goblin('Actor.g2', 'Goblin 2'), delivery: 'melee', hit: false },
			{ actor: goblin('Actor.g3', 'Goblin 3'), delivery: 'melee', hit: true },
		]);

		await hit(back, ally(15, [rule(15)]), 3);

		expect(written().map((record) => record.attackerName)).toEqual(['Goblin 1', 'Goblin 3']);
	});
});
