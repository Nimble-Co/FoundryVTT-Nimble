import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { DefendOptionRule } from '../../../models/rules/defendOption.js';

vi.mock('../../../dice/DamageRoll.js', () => ({
	DamageRoll: class {
		formula: string;
		isCritical = false;
		isMiss = false;
		constructor(formula: string, _data?: unknown) {
			this.formula = formula;
		}
		async evaluate() {}
		toJSON() {
			return {
				class: 'DamageRoll',
				formula: this.formula,
				total: 5,
				isCritical: false,
				isMiss: false,
				terms: [
					{
						number: 1,
						faces: 4,
						results: [{ result: 3, active: true, discarded: false }],
					},
					{ operator: '+' },
					{ number: 2 },
				],
			};
		}
	},
}));

let offerDefendOptionAttacks: typeof import('../defendOptionAttack.js').offerDefendOptionAttacks;

beforeAll(async () => {
	vi.resetModules();
	({ offerDefendOptionAttacks } = await import('../defendOptionAttack.js'));
});

const TARGET = 'Scene.s.Token.goblin';

type Globals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: {
		user: { isGM: boolean; id?: string };
		scenes?: unknown;
		i18n: { localize: (key: string) => string; format: (key: string, data?: object) => string };
	};
	Hooks: { call: ReturnType<typeof vi.fn>; callAll: ReturnType<typeof vi.fn> };
	ui: { notifications: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> } };
};

function globals() {
	return globalThis as unknown as Globals;
}

const SAVED = ['fromUuidSync', 'Hooks'].map(
	(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
);

function confirm() {
	return foundry.applications.api.DialogV2.confirm as unknown as ReturnType<typeof vi.fn>;
}

function rule(formula: string | null): DefendOptionRule {
	return {
		attackOffer: () => {
			const trimmed = (formula ?? '').trim();
			return trimmed || null;
		},
		label: 'Protect Me!',
		parentDocument: { name: 'Medium - Protect Me!', img: 'icons/dog.webp' },
	} as unknown as DefendOptionRule;
}

function card() {
	const goblin = { name: 'Goblin', uuid: TARGET };
	globals().game.scenes = {
		get: () => ({ tokens: { get: () => ({ uuid: TARGET, actor: goblin }) } }),
	};
	return { speaker: { scene: 's', token: 'goblin' } } as unknown as ChatMessage;
}

describe('offerDefendOptionAttacks', () => {
	const created: unknown[] = [];
	const applyAll = vi.fn(async () => undefined);
	let isGMBefore = true;

	beforeEach(() => {
		created.length = 0;
		applyAll.mockClear();
		confirm().mockReset();
		isGMBefore = globals().game.user.isGM;
		(ChatMessage as unknown as { getSpeaker: ReturnType<typeof vi.fn> }).getSpeaker = vi.fn(() => ({
			alias: 'Hero',
		}));
		(ChatMessage as unknown as { create: ReturnType<typeof vi.fn> }).create = vi.fn(
			async (data: unknown) => {
				created.push(data);
				return { applyAllDamage: applyAll };
			},
		);
	});

	afterEach(() => {
		for (const [key, descriptor] of SAVED) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
		globals().game.user.isGM = isGMBefore;
	});

	it('asks nothing when the formula is empty', async () => {
		await offerDefendOptionAttacks({
			rules: [rule(null), rule('   ')],
			actor: { name: 'Hero', getRollData: () => ({ level: 2 }) } as unknown as Actor.Implementation,
			card: card(),
		});

		expect(confirm()).not.toHaveBeenCalled();
		expect(created).toEqual([]);
	});

	it('rolls nothing when the player declines', async () => {
		confirm().mockResolvedValue(false);

		await offerDefendOptionAttacks({
			rules: [rule('1d4+@level')],
			actor: { name: 'Hero', getRollData: () => ({ level: 2 }) } as unknown as Actor.Implementation,
			card: card(),
		});

		expect(confirm()).toHaveBeenCalledTimes(1);
		expect(created).toEqual([]);
	});

	it('asks nothing when the attacker has no token, and the caller can still Defend', async () => {
		await offerDefendOptionAttacks({
			rules: [rule('1d4+@level')],
			actor: { name: 'Hero', getRollData: () => ({}) } as unknown as Actor.Implementation,
			card: { speaker: {} } as ChatMessage,
		});

		expect(confirm()).not.toHaveBeenCalled();
	});

	it('rolls the formula against the attacker, and medium armor drops the flat bonus', async () => {
		confirm().mockResolvedValue(true);
		const actor = {
			name: 'Goblin',
			applyDamage: vi.fn().mockResolvedValue(undefined),
			system: {
				attributes: {
					armor: 'medium',
					hp: { value: 20, temp: 0, max: 20 },
					damageResistances: [],
					damageImmunities: [],
					damageVulnerabilities: [],
				},
				damageReductions: [],
			},
			effects: [],
			deleteEmbeddedDocuments: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
		};
		globals().fromUuidSync = vi.fn().mockReturnValue({ actor });
		globals().Hooks = { call: vi.fn(), callAll: vi.fn() };
		globals().game.user.isGM = true;

		await offerDefendOptionAttacks({
			rules: [rule('1d4+@level')],
			actor: { name: 'Hero', getRollData: () => ({ level: 2 }) } as unknown as Actor.Implementation,
			card: card(),
		});

		expect(created).toHaveLength(1);
		const posted = created[0] as {
			type: string;
			rolls: { formula: string }[];
			system: {
				isMiss: boolean;
				targets: string[];
				activation: {
					effects: Array<{ formula: string; ignoreArmor?: boolean; roll: { total: number } }>;
				};
			};
		};
		expect(posted.type).toBe('feature');
		expect(posted.system.targets).toEqual([TARGET]);
		expect(posted.system.isMiss).toBe(false);
		expect(posted.rolls[0]?.formula).toBe('1d4+@level');
		const node = posted.system.activation.effects[0];
		expect(node?.formula).toBe('1d4+@level');
		expect(node?.roll.total).toBe(5);
		expect(node).not.toHaveProperty('ignoreArmor');
		expect(applyAll).toHaveBeenCalledTimes(1);

		const message = new NimbleChatMessage({
			_id: 'companionattack01',
			type: posted.type,
			system: posted.system,
		} as unknown as ChatMessage.CreateData);
		Object.assign(message, { update: vi.fn().mockResolvedValue(undefined) });
		await message.applyAllDamage();

		expect(actor.applyDamage).toHaveBeenCalledWith(3);
	});
});
