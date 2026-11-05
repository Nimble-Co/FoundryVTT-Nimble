import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from '../chatMessage.js';

type TestGlobals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: { user: { isGM: boolean } };
	Hooks: { call: ReturnType<typeof vi.fn>; callAll: ReturnType<typeof vi.fn> };
};

const TOKEN = 'Scene.scene.Token.token';

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createHero(config: { vulnerabilities?: string[]; damageReductions?: object[] } = {}) {
	const actor = {
		name: 'Hero',
		type: 'character',
		applyDamage: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor: 'none',
				hp: { value: 40, temp: 0, max: 40 },
				damageResistances: [],
				damageImmunities: [],
				damageVulnerabilities: config.vulnerabilities ?? [],
			},
			damageReductions: config.damageReductions ?? [],
		},
		effects: [],
		deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
	};
	return actor;
}

function packet(id: string, damageType: string, total: number, ignoreArmor = false) {
	return {
		id,
		type: 'damage',
		damageType,
		formula: String(total),
		canCrit: false,
		canMiss: false,
		parentNode: null,
		parentContext: null,
		...(ignoreArmor ? { ignoreArmor: true } : {}),
		roll: {
			class: 'Roll',
			formula: String(total),
			total,
			evaluated: true,
			options: {},
			terms: [{ class: 'NumericTerm', number: total, evaluated: true, options: {} }],
		},
		on: {
			hit: [
				{
					id: `${id}-hit`,
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentNode: id,
					parentContext: 'hit',
				},
			],
		},
	};
}

function card(
	packets: ReturnType<typeof packet>[],
	defend: { armor: number; armorApplies?: boolean; outcome?: string; armorBonus?: number } | null,
) {
	const message = new NimbleChatMessage({
		type: 'spell',
		system: {
			targets: [TOKEN],
			isCritical: false,
			isMiss: false,
			activation: { effects: packets },
			defends: defend
				? [
						{
							id: 'd1',
							tokenUuid: TOKEN,
							actorUuid: 'Actor.hero',
							armor: defend.armor,
							armorApplies: defend.armorApplies ?? true,
							label: '',
							userId: 'u1',
							combatantId: 'c1',
							previousActions: 3,
							reactionKeys: ['defend'],
							outcome: defend.outcome ?? 'none',
							armorBonus: defend.armorBonus ?? 0,
						},
					]
				: [],
			damageAppliedTo: [],
		},
	} as unknown as ChatMessage.CreateData);
	Object.assign(message, { update: vi.fn().mockResolvedValue(undefined) });
	return message;
}

describe('Defend armor on an attack card', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user.isGM = true;
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
	});

	it('takes the armor off the damage once for the whole attack', async () => {
		const hero = createHero();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

		await card([packet('a', 'slashing', 10), packet('b', 'fire', 6)], {
			armor: 4,
		}).applyAllDamage();

		expect(hero.applyDamage).toHaveBeenCalledWith(12);
	});

	it('takes no armor when the GM turns Armor applies off', async () => {
		const hero = createHero();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

		await card([packet('a', 'slashing', 10)], { armor: 4, armorApplies: false }).applyAllDamage();

		expect(hero.applyDamage).toHaveBeenCalledWith(10);
	});

	it('does not reduce damage that ignores armor', async () => {
		const hero = createHero();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

		await card([packet('a', 'slashing', 10, true)], { armor: 4 }).applyAllDamage();

		expect(hero.applyDamage).toHaveBeenCalledWith(10);
	});

	it('doubles vulnerable damage before the armor comes off', async () => {
		const hero = createHero({ vulnerabilities: ['fire'] });
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

		await card([packet('a', 'fire', 5)], { armor: 4 }).applyAllDamage();

		expect(hero.applyDamage).toHaveBeenCalledWith(6);
	});

	it('takes the armor off as well as other flat reductions', async () => {
		const hero = createHero({ damageReductions: [{ value: 2, damageTypes: [] }] });
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

		await card([packet('a', 'slashing', 9)], { armor: 4 }).applyAllDamage();

		expect(hero.applyDamage).toHaveBeenCalledWith(3);
	});

	it('previews the same damage that is applied', async () => {
		const hero = createHero();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });
		const message = card([packet('a', 'slashing', 17)], { armor: 3 });

		expect(message.previewDamageFor(TOKEN, 0)).toBe(17);
		expect(message.previewDamageFor(TOKEN, 3)).toBe(14);
		expect(message.getDamageBreakdownForTarget(TOKEN)?.total).toBe(14);
		await message.applyAllDamage();
		expect(hero.applyDamage).toHaveBeenCalledWith(14);
	});

	it('takes the armor off a minion group attack once, for the total', async () => {
		const hero = createHero();
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });
		const message = new NimbleChatMessage({
			type: 'minionGroupAttack',
			system: {
				targets: [TOKEN],
				totalDamage: 9,
				rows: [],
				defends: [
					{ id: 'd1', tokenUuid: TOKEN, actorUuid: 'Actor.hero', armor: 4, armorApplies: true },
				],
				damageAppliedTo: [],
			},
		} as unknown as ChatMessage.CreateData);
		Object.assign(message, { update: vi.fn().mockResolvedValue(undefined) });

		expect(message.previewDamageFor(TOKEN, 0)).toBe(9);
		expect(message.previewDamageFor(TOKEN, 4)).toBe(5);
		await message.applyDamage(9, { outcome: 'fullDamage' });
		expect(hero.applyDamage).toHaveBeenCalledWith(5);
	});

	describe('Defend options', () => {
		it('deals no damage when the Defend makes the attack miss', async () => {
			const hero = createHero();
			globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });
			const message = card([packet('a', 'slashing', 17)], { armor: 3, outcome: 'miss' });

			expect(message.getDamageBreakdownForTarget(TOKEN)?.total).toBe(0);
			expect(message.previewDamageFor(TOKEN, { armor: 3, zero: true })).toBe(0);
			await message.applyAllDamage();
			expect(hero.applyDamage).not.toHaveBeenCalled();
		});

		it('halves the damage, rounded up, in place of the armor', async () => {
			const hero = createHero();
			globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });
			const message = card([packet('a', 'slashing', 17)], { armor: 3, outcome: 'halve' });

			expect(message.getDamageBreakdownForTarget(TOKEN)?.total).toBe(9);
			expect(message.previewDamageFor(TOKEN, { armor: 3, halve: true })).toBe(9);
			await message.applyAllDamage();
			expect(hero.applyDamage).toHaveBeenCalledWith(9);
		});

		it('takes the whole damage when the GM turns the armor off on a halving Defend', async () => {
			const hero = createHero();
			globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });

			await card([packet('a', 'slashing', 17)], {
				armor: 3,
				outcome: 'halve',
				armorApplies: false,
			}).applyAllDamage();

			expect(hero.applyDamage).toHaveBeenCalledWith(17);
		});

		it('adds the option armor to the hero armor', async () => {
			const hero = createHero();
			globals().fromUuidSync = vi.fn().mockReturnValue({ actor: hero });
			const message = card([packet('a', 'slashing', 17)], { armor: 3, armorBonus: 2 });

			expect(message.getDamageBreakdownForTarget(TOKEN)?.total).toBe(12);
			await message.applyAllDamage();
			expect(hero.applyDamage).toHaveBeenCalledWith(12);
		});
	});
});
