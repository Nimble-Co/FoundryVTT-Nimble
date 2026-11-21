import { SYSTEM_ID } from '#system';
import type { ApplyEffectNode } from '#types/effectTree.js';
import { applyEffectFromCard } from '#utils/chat/applyEffectFromCard.js';
import { CardDamageBack } from '../cardDamageBack.js';

/** Foundry's Roll, for formulas with `@` references and floor(). */
class FormulaRoll {
	total = 0;

	constructor(
		readonly formula: string,
		readonly data: Record<string, unknown> = {},
	) {}

	static replaceFormulaData(formula: string, data: Record<string, unknown>) {
		return formula.replace(/@([\w.]+)/g, (_match, path: string) => {
			const value = foundry.utils.getProperty(data, path);
			return value === undefined ? '0' : String(value);
		});
	}

	async evaluate() {
		const text = FormulaRoll.replaceFormulaData(this.formula, this.data);
		this.total = new Function('floor', `return (${text})`)(Math.floor) as number;
		return this;
	}

	toJSON() {
		return { formula: this.formula, total: this.total };
	}
}

const auraRule = {
	id: 'aura',
	type: 'damageBack',
	trigger: 'damaged',
	attackDelivery: 'melee',
	onlyCrits: false,
	amount: 'formula',
	formula: 'floor(@cost.hp / 2)',
	damageType: 'cold',
	ignoreArmor: true,
};

const auraEffect = {
	name: 'Frost Aura',
	transfer: false,
	toObject: () => ({
		_id: 'aura',
		name: 'Frost Aura',
		statuses: [],
		system: { lastsUntil: [], rules: [auraRule] },
	}),
};

const caster = {
	uuid: 'Actor.caster',
	name: 'Vex',
	type: 'character',
	isOwner: true,
	effects: [],
	getRollData: () => ({ attributes: { hp: { max: 29 } } }),
};
const spell = { uuid: 'Actor.caster.Item.frost-lance', actor: caster };
const feature = {
	uuid: "Actor.caster.Item.cryomancer's-reprisal",
	actor: caster,
	effects: { get: (id: string) => (id === 'aura' ? auraEffect : undefined) },
};

const step: ApplyEffectNode = {
	id: 'useOptionaura',
	type: 'applyEffect',
	effectId: 'aura',
	effectItemUuid: feature.uuid,
	recipient: 'self',
	parentContext: null,
	parentNode: null,
};

function castCard(sacrificed: number) {
	return {
		id: 'cast',
		flags: { [SYSTEM_ID]: { itemUuid: spell.uuid } },
		system: {
			costs: [{ kind: 'hp', amount: sacrificed, source: "Cryomancer's Reprisal" }],
			activation: { effects: [step] },
		},
		update: vi.fn(async () => undefined),
	};
}

describe('an aura that reads the HP the cast sacrificed', () => {
	const createEffect = vi.fn();
	let previousActiveEffect: unknown;

	beforeEach(() => {
		createEffect.mockReset().mockResolvedValue({ uuid: 'Actor.caster.ActiveEffect.aura' });
		vi.stubGlobal('Roll', FormulaRoll);
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === spell.uuid ? spell : uuid === feature.uuid ? feature : null,
			),
		);
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => ({ uuid })),
		);
		previousActiveEffect = (CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect;
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create: createEffect, deleteDocuments: vi.fn() },
		};
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
	});

	afterEach(() => {
		(CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect = previousActiveEffect;
		vi.unstubAllGlobals();
	});

	/** The aura on the caster after the cast, as its rule reads it when it acts. */
	async function auraAfterCast(sacrificed: number) {
		await applyEffectFromCard(castCard(sacrificed), step);
		const [data] = createEffect.mock.calls[0] as [{ system: { rules: (typeof auraRule)[] } }];
		const [rule] = data.system.rules;
		return { ...rule, rollData: () => ({}), answersAttack: () => true };
	}

	async function meleeHit(rule: Awaited<ReturnType<typeof auraAfterCast>>) {
		const attacker = { uuid: 'Actor.ogre', name: 'Ogre', applyDamage: vi.fn() };
		const update = vi.fn(async (_changes: Record<string, unknown>) => undefined);
		const back = new CardDamageBack({
			id: () => 'club',
			attacker: () => attacker,
			records: () => [],
			update,
		});
		await back.afterDamage([{ actor: { uuid: caster.uuid, rules: [rule] }, taken: 9 }], {
			isCritical: false,
			critDiceTotal: 0,
		});
		return { attacker, update };
	}

	it('deals cold damage of half the HP sacrificed to the melee attacker', async () => {
		const { attacker, update } = await meleeHit(await auraAfterCast(14));

		expect(attacker.applyDamage).toHaveBeenCalledWith(7);
		const [changes] = update.mock.calls[0] as [Record<string, Array<Record<string, unknown>>>];
		expect(changes['system.damageBack'][0]).toMatchObject({ amount: 7, damageType: 'cold' });
	});

	it('rounds half of an odd sacrifice down', async () => {
		const { attacker } = await meleeHit(await auraAfterCast(15));

		expect(attacker.applyDamage).toHaveBeenCalledWith(7);
	});
});
