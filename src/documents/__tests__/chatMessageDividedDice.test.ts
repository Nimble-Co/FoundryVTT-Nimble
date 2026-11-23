import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from '../chatMessage.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const GOBLIN = 'Scene.scene.Token.goblin';
const ORC = 'Scene.scene.Token.orc';

function creature(name: string, armor = 'none') {
	const actor = {
		name,
		applyDamage: vi.fn().mockResolvedValue(undefined),
		system: {
			attributes: {
				armor,
				hp: { value: 30, temp: 0, max: 30 },
				damageResistances: [],
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			damageReductions: [],
		},
		effects: [],
	};
	return actor;
}

function diceRoll(faces: number[], extra = 0, isCritical?: boolean) {
	const dice = faces.reduce((sum, face) => sum + face, 0);
	return {
		class: 'Roll',
		formula: `${faces.length}d12${extra ? ` + ${extra}` : ''}`,
		total: dice + extra,
		...(isCritical === undefined ? {} : { isCritical }),
		evaluated: true,
		options: {},
		terms: [
			{
				class: 'Die',
				faces: 12,
				number: faces.length,
				results: faces.map((result) => ({ result, active: true })),
			},
			...(extra
				? [
						{ class: 'OperatorTerm', operator: '+' },
						{ class: 'NumericTerm', number: extra, options: {} },
					]
				: []),
		],
	};
}

function node(id: string, forTarget: string, roll: object, more: object = {}) {
	return {
		id,
		type: 'damage',
		damageType: 'slashing',
		formula: 'x',
		forTarget,
		parentNode: null,
		parentContext: null,
		roll,
		...more,
		on: {
			hit: [
				{
					id: `${id}Full`,
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentNode: id,
					parentContext: 'hit',
				},
			],
		},
	};
}

/** Goblin takes 2d12 (5, 7) + 3; Orc takes 1d12 (4). */
function dividedCard(isCritical = false) {
	const card = new NimbleChatMessage({
		type: 'feature',
		system: {
			targets: [GOBLIN, ORC],
			isCritical,
			isMiss: false,
			activation: {
				effects: [
					node('slash', GOBLIN, diceRoll([5, 7], 3, isCritical)),
					node('slash-share1', ORC, diceRoll([4]), { sharesAttackRoll: true }),
				],
			},
		},
	} as unknown as ChatMessage.CreateData);
	Object.assign(card, { update: vi.fn().mockResolvedValue(card) });
	return card;
}

function world(orcArmor = 'none') {
	const goblin = creature('Goblin');
	const orc = creature('Orc', orcArmor);
	globals.fromUuidSync = vi.fn((uuid: string) => {
		if (uuid === GOBLIN) return { actor: goblin, name: 'Goblin' };
		if (uuid === ORC) return { actor: orc, name: 'Orc' };
		return null;
	});
	return { goblin, orc };
}

beforeEach(() => {
	vi.clearAllMocks();
	globals.game.user.isGM = true;
	globals.Hooks = { call: vi.fn(), callAll: vi.fn() };
});

describe('a card whose dice are divided among its targets', () => {
	it('shows each target only its own damage', () => {
		world();
		const card = dividedCard();

		expect(card.getDamageBreakdownForTarget(GOBLIN)?.total).toBe(15);
		expect(card.getDamageBreakdownForTarget(ORC)?.total).toBe(4);
	});

	it('gives each target its own damage', async () => {
		const { goblin, orc } = world();

		await dividedCard().applyAllDamage();

		expect(goblin.applyDamage).toHaveBeenCalledWith(15);
		expect(orc.applyDamage).toHaveBeenCalledWith(4);
	});

	it("puts each target's dice through its own armor", () => {
		world('heavy');

		expect(dividedCard().getDamageBreakdownForTarget(ORC)?.total).toBe(2);
	});

	it('is a crit for every target when the attack crits, so armor does not stop it', () => {
		world('heavy');

		expect(dividedCard(true).getDamageBreakdownForTarget(ORC)?.total).toBe(4);
	});
});
