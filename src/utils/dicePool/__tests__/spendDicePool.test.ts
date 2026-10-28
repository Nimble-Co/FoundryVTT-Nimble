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
