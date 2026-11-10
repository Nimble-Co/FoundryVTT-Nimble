import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NimbleCharacter } from '#documents/actor/character.js';
import { SYSTEM_ID } from '#system';
import type { DicePoolConsumer } from '../dicePoolConsumers.js';
import { spendDicePool } from '../spendDicePool.js';

type PostedRoll = { formula: string; total: number; flavor: string };

const postedRolls: PostedRoll[] = [];

beforeEach(() => {
	postedRolls.length = 0;
	const BaseRoll = (globalThis as unknown as { Roll: new (...args: unknown[]) => object }).Roll;
	class ArithmeticRoll extends BaseRoll {
		declare formula: string;
		declare _total: number;
		async evaluate(): Promise<this> {
			this._total = new Function(`return (${this.formula})`)() as number;
			return this;
		}
		get total(): number {
			return this._total;
		}
		async toMessage(data: { flavor: string }): Promise<void> {
			postedRolls.push({ formula: this.formula, total: this._total, flavor: data.flavor });
		}
	}
	(globalThis as unknown as { Roll: unknown }).Roll = ArithmeticRoll;
	(globalThis as unknown as { ChatMessage: unknown }).ChatMessage = {
		create: vi.fn(async () => ({})),
		getSpeaker: vi.fn(() => ({})),
	};
	(foundry.utils as unknown as { escapeHTML: (value: string) => string }).escapeHTML = (
		value: string,
	) => value;
});

function createActor(faces: number[]) {
	const item = {
		id: 'item-rage',
		name: 'Rage',
		flags: {
			[SYSTEM_ID]: {
				dicePools: {
					fury: { identifier: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 4, faces },
				},
			},
		} as Record<string, unknown>,
		rules: new Map<string, unknown>([
			[
				'fury-pool',
				{
					type: 'dicePool',
					id: 'fury-pool',
					identifier: 'fury',
					label: 'Fury Dice',
					scope: 'item',
					dieSize: 'd6',
					max: '4',
					refills: [],
				},
			],
		]),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(item, path, value);
			}
			return item;
		}),
	};
	const actor = {
		type: 'character',
		items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
		effects: { find: () => undefined, filter: () => [] },
		createEmbeddedDocuments: vi.fn(async () => []),
		getRollData: () => ({}),
		update: vi.fn(async () => undefined),
	};
	const persistedFaces = () =>
		(
			foundry.utils.getProperty(item, `flags.${SYSTEM_ID}.dicePools`) as Record<
				string,
				{ faces: number[] }
			>
		).fury.faces;
	return { actor: actor as unknown as NimbleCharacter, raw: actor, persistedFaces };
}

function consumer(overrides: Partial<DicePoolConsumer> = {}): DicePoolConsumer {
	return {
		itemId: 'item-rage',
		itemName: 'Rage',
		itemImg: 'icons/rage.webp',
		itemDescription: '',
		ruleId: 'spend-rule',
		ruleLabel: 'Spend',
		cost: '1',
		effectFormula: '@sum',
		effectType: 'generic',
		selectionOutcome: 'consume',
		damageType: '',
		cardOffer: null,
		bonusOnAttackDelivery: null,
		...overrides,
	};
}

const pool = (faces: number[]) => ({ id: 'fury', label: 'Fury Dice', faces });

describe('spendDicePool', () => {
	it('removes the picked dice and rolls the effect with @n and @sum', async () => {
		const { actor, persistedFaces } = createActor([2, 6, 3]);

		await spendDicePool({
			actor,
			pool: pool([2, 6, 3]),
			consumer: consumer({ effectFormula: '@n * 10 + @sum' }),
			selectedIndices: [0, 2],
		});

		expect(persistedFaces()).toEqual([6]);
		expect(postedRolls).toHaveLength(1);
		expect(postedRolls[0].formula).toBe('2 * 10 + 5');
		expect(postedRolls[0].total).toBe(25);
		expect(postedRolls[0].flavor).toContain('Spent 2 Fury Dice (2, 3)');
	});

	it('banks the effect total as damage reduction for a damageReduction consumer', async () => {
		const { actor, raw } = createActor([4, 5]);

		await spendDicePool({
			actor,
			pool: pool([4, 5]),
			consumer: consumer({ effectType: 'damageReduction' }),
			selectedIndices: [1],
		});

		expect(raw.createEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', [
			expect.objectContaining({
				flags: { [SYSTEM_ID]: expect.objectContaining({ bankedDamageReduction: 5 }) },
			}),
		]);
		expect(postedRolls[0].flavor).toContain('<br />');
	});

	it('raises the picked dice in place for a maximize consumer and posts the change', async () => {
		const { actor, persistedFaces } = createActor([2, 6, 3]);

		await spendDicePool({
			actor,
			pool: pool([2, 6, 3]),
			consumer: consumer({ selectionOutcome: 'maximize', effectFormula: null }),
			selectedIndices: [2],
		});

		expect(persistedFaces()).toEqual([2, 6, 6]);
		expect(postedRolls).toHaveLength(0);
		const chat = (globalThis as unknown as { ChatMessage: { create: ReturnType<typeof vi.fn> } })
			.ChatMessage;
		expect(chat.create).toHaveBeenCalledTimes(1);
		expect(String(chat.create.mock.calls[0][0].content)).toContain('3 → 6');
	});

	it('does nothing when no picked index points at a die', async () => {
		const { actor, persistedFaces } = createActor([2, 6]);

		await spendDicePool({
			actor,
			pool: pool([2, 6]),
			consumer: consumer(),
			selectedIndices: [5],
		});

		expect(persistedFaces()).toEqual([2, 6]);
		expect(postedRolls).toHaveLength(0);
	});
});

describe('spendDicePool with a giveEffect consumer', () => {
	const createEffect = vi.fn();
	const globals = globalThis as unknown as Record<string, any>;
	let savedTargets: unknown;
	let savedActiveEffect: unknown;

	const mandate = {
		name: 'Shining Mandate',
		transfer: false,
		toObject: () => ({
			_id: 'eff1',
			name: 'Shining Mandate',
			transfer: false,
			system: {
				rules: [{ type: 'heldRoll', heldKind: 'extraDamage', formula: '1d@pools.judgment.faces' }],
			},
		}),
	};

	function oathsworn(faces: number[]) {
		const created = createActor(faces);
		const item = created.raw.items.contents[0] as Record<string, unknown>;
		item.uuid = 'Actor.paladin.Item.item-rage';
		item.effects = [{ name: 'Aura', transfer: true, toObject: () => ({}) }, mandate];
		Object.assign(created.raw, {
			uuid: 'Actor.paladin',
			getRollData: () => ({ pools: { judgment: { faces: 10 } } }),
		});
		return created;
	}

	function ally(name: string) {
		return {
			uuid: `Actor.${name}`,
			name,
			isOwner: true,
			effects: [],
			system: { attributes: { hp: { temp: 0 } } },
			update: vi.fn(async () => undefined),
		};
	}

	function target(...actors: ReturnType<typeof ally>[]) {
		globals.game.user.targets = new Set(actors.map((actor) => ({ actor })));
	}

	const give = () => consumer({ effectFormula: null, effectType: 'giveEffect' });

	beforeEach(() => {
		savedTargets = globals.game.user?.targets;
		savedActiveEffect = globals.CONFIG.ActiveEffect;
		globals.game.user ??= {};
		createEffect.mockReset().mockImplementation(async (_data: unknown, { parent }) => ({
			uuid: `${parent.uuid}.ActiveEffect.new`,
		}));
		globals.CONFIG.ActiveEffect = {
			documentClass: { create: createEffect, deleteDocuments: vi.fn() },
		};
		globals.Roll.replaceFormulaData = (formula: string, data: any) =>
			formula.replace('@pools.judgment.faces', String(data.pools.judgment.faces));
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => ({ uuid })),
		);
	});

	afterEach(() => {
		globals.game.user.targets = savedTargets;
		globals.CONFIG.ActiveEffect = savedActiveEffect;
		vi.unstubAllGlobals();
	});

	it('spends nothing and warns when the user has no target', async () => {
		const { actor, persistedFaces } = oathsworn([4, 7]);
		target();
		const warn = vi.spyOn(ui.notifications!, 'warn');

		await spendDicePool({ actor, pool: pool([4, 7]), consumer: give(), selectedIndices: [1] });

		expect(warn).toHaveBeenCalledWith('Target a creature to give Rage to. No dice were spent.');
		expect(persistedFaces()).toEqual([4, 7]);
		expect(createEffect).not.toHaveBeenCalled();
		expect(globals.ChatMessage.create).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it('removes the picked die, gives the effect to each target, and posts the note', async () => {
		const { actor, persistedFaces } = oathsworn([4, 7]);
		const mira = ally('Mira');
		const tor = ally('Tor');
		target(mira, tor);

		await spendDicePool({ actor, pool: pool([4, 7]), consumer: give(), selectedIndices: [1] });

		expect(persistedFaces()).toEqual([4]);
		expect(createEffect).toHaveBeenCalledTimes(2);
		const [data, options] = createEffect.mock.calls[0];
		expect(options.parent).toBe(mira);
		expect(createEffect.mock.calls[1][1].parent).toBe(tor);
		expect(data).toMatchObject({
			name: 'Shining Mandate',
			origin: 'Actor.paladin.Item.item-rage',
			system: { rules: [{ formula: '1d10' }] },
		});
		expect(postedRolls).toHaveLength(0);
		const content = globals.ChatMessage.create.mock.calls[0][0].content as string;
		expect(content).toContain('Spent 1 Fury Dice (7)');
		expect(content).toContain('Gave Shining Mandate to Mira, Tor');
	});
});
