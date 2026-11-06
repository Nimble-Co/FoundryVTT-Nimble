import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	IncomingReactionEntry,
	RerollRecord,
} from '../../incomingReactions/incomingReactionEntry.js';
import { type AutomaticRerollTarget, chainAutomaticRerolls } from '../automaticRerolls.js';
import type { AutomaticReroll, RerollRuleLike } from '../rerollEntries.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown } };
};

type Roll = { primaryDieValue: number };

function automatic(id: string): AutomaticReroll {
	const entry = {
		id: `entry-${id}`,
		kind: 'reroll',
		source: 'rule',
		actorUuid: 'Actor.hero',
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: id,
		ruleId: `rule-${id}`,
		itemUuid: `Item.${id}`,
		used: false,
		outcomeTrigger: 'always',
	} satisfies IncomingReactionEntry;
	const rule: RerollRuleLike = {
		type: 'reroll',
		id: `rule-${id}`,
		rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
	};
	return { entry, rule };
}

/** A roll-time chain over `queue`: each placed Reroll is taken off the front. */
function chainOver(queue: AutomaticReroll[], makeRoll: AutomaticRerollTarget<Roll>['makeRoll']) {
	let roll: Roll = { primaryDieValue: 1 };
	const placed: RerollRecord[] = [];
	const left = [...queue];
	const chain = {
		rollKind: 'attack' as const,
		roller: null,
		next: () => left[0] ?? null,
		target: () => ({
			replaced: { originalFormula: '1d8', options: {} },
			previousResult: roll.primaryDieValue,
			makeRoll,
		}),
		appliedRollChanges: () => [],
		earlierCritTriggers: () => false,
		place: vi.fn(async (done: { roll: Roll; reroll: RerollRecord }) => {
			roll = done.roll;
			placed.push(done.reroll);
			left.shift();
		}),
	};
	return { chain, placed, roll: () => roll };
}

describe('chainAutomaticRerolls', () => {
	beforeEach(() => {
		testGlobals.game.settings = { get: () => true };
	});
	afterEach(() => {
		delete testGlobals.game.settings;
	});

	it('runs each automatic Reroll until none is left, the second result standing each time', async () => {
		let face = 1;
		const run = chainOver(
			[automatic('a'), automatic('b')],
			vi.fn(async () => ({ primaryDieValue: ++face })),
		);

		await chainAutomaticRerolls(run.chain);

		expect(run.placed.map((reroll) => [reroll.entryId, reroll.automatic])).toEqual([
			['entry-a', true],
			['entry-b', true],
		]);
		expect(run.roll()).toEqual({ primaryDieValue: 3 });
	});

	it('logs a failed Reroll, stops, and keeps the Rerolls before it', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
		let calls = 0;
		const run = chainOver(
			[automatic('a'), automatic('b'), automatic('c')],
			vi.fn(async () => {
				calls += 1;
				if (calls === 2) throw new Error('roll failed');
				return { primaryDieValue: 5 };
			}),
		);

		try {
			await chainAutomaticRerolls(run.chain);

			expect(run.placed.map((reroll) => reroll.entryId)).toEqual(['entry-a']);
			expect(run.roll()).toEqual({ primaryDieValue: 5 });
			expect(logged).toHaveBeenCalledWith(
				'Nimble | An automatic reroll failed.',
				expect.any(Error),
			);
		} finally {
			logged.mockRestore();
		}
	});

	it('stops when the roll has nothing to replace', async () => {
		const makeRoll = vi.fn(async () => ({ primaryDieValue: 2 }));
		const run = chainOver([automatic('a')], makeRoll);

		await chainAutomaticRerolls({ ...run.chain, target: () => null });

		expect(makeRoll).not.toHaveBeenCalled();
		expect(run.chain.place).not.toHaveBeenCalled();
	});
});
