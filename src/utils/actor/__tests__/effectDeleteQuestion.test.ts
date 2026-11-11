import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const poolsLostOnEnd = vi.fn((_effect: unknown): string[] => []);

let effectDeleteQuestion: typeof import('../effectDeleteQuestion.ts').effectDeleteQuestion;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/dicePool/poolsEmptiedAtEnd.js', () => ({ poolsLostOnEnd }));
	({ effectDeleteQuestion } = await import('../effectDeleteQuestion.ts'));
});

const ITEM_UUID = 'Actor.hero.Item.rage';

function stubOriginItem(effects: { id: string; name: string; transfer: boolean }[]) {
	const item = {
		documentName: 'Item',
		effects: Object.assign([...effects], {
			get: (id: string) => effects.find((each) => each.id === id),
		}),
	};
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === ITEM_UUID ? item : null)),
	);
}

describe('effectDeleteQuestion', () => {
	beforeEach(() => {
		poolsLostOnEnd.mockReturnValue([]);
		stubOriginItem([]);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('asks nothing for an effect with no origin and no pool to lose', () => {
		expect(effectDeleteQuestion({ name: 'Haste' })).toBeNull();
	});

	it('adds one line for each pool that the end of the effect empties', () => {
		poolsLostOnEnd.mockReturnValue(['Fury Dice', 'Shadow Dice']);

		expect(effectDeleteQuestion({ name: 'Raging' })).toEqual([
			'Delete Raging?',
			'Your Fury Dice are lost.',
			'Your Shadow Dice are lost.',
		]);
	});

	it('asks a plain question when the origin item can give the effect again', () => {
		stubOriginItem([{ id: 'raging', name: 'Raging', transfer: false }]);

		expect(effectDeleteQuestion({ name: 'Raging', origin: ITEM_UUID })).toEqual(['Delete Raging?']);
	});

	it('warns that the effect cannot come back when the origin item does not give it', () => {
		stubOriginItem([{ id: 'raging', name: 'Raging', transfer: true }]);
		poolsLostOnEnd.mockReturnValue(['Fury Dice']);

		const lines = effectDeleteQuestion({ name: 'Raging', origin: ITEM_UUID });

		expect(lines?.[0]).toContain('cannot be restored without re-adding the item');
		expect(lines?.[1]).toBe('Your Fury Dice are lost.');
	});

	it('warns for a passive effect that its item holds', () => {
		const lines = effectDeleteQuestion({ name: 'Stoneskin', parent: { documentName: 'Item' } });

		expect(lines?.[0]).toContain('cannot be restored without re-adding the item');
	});
});
