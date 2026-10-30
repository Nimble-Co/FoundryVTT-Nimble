import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from '../../incomingReactions/incomingReactionEntry.js';
import type { RerollCost } from '../rerollCost.js';
import type { RerollRuleLike } from '../rerollEntries.js';
import { type ReplacedRoll, type RerollStepInput, rerollWithRule } from '../rerollStep.js';

const testGlobals = globalThis as unknown as {
	game: { settings?: { get: (scope: string, key: string) => unknown }; combat?: unknown };
};

function cost(overrides: Partial<RerollCost> = {}): RerollCost {
	return {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		...overrides,
	};
}

function makeActor(options: { charges?: number; mana?: number; wounds?: number } = {}) {
	const item = {
		id: 'pool-item',
		name: 'Pocket Sand',
		flags: { nimble: { chargePools: { sand: { current: options.charges ?? 0, max: 2 } } } },
		rules: new Map([
			[
				'pool',
				{
					type: 'chargePool',
					disabled: false,
					id: 'sand',
					identifier: 'sand',
					scope: 'item',
					max: '2',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const pools = changes['flags.nimble.chargePools'] as Record<string, { current: number }>;
			item.flags.nimble.chargePools.sand.current = pools.sand.current;
		}),
	};
	const actor = {
		uuid: 'Actor.hero',
		type: 'character',
		flags: {},
		system: {
			resources: { mana: { current: options.mana ?? 0, max: 5 } },
			attributes: { wounds: { value: options.wounds ?? 0, max: 6 } },
		},
		getRollData: () => ({}),
		items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

const ENTRY = {
	id: 'entry-1',
	kind: 'reroll',
	source: 'rule',
	actorUuid: 'Actor.hero',
	tokenUuid: null,
	targetTokenUuid: null,
	side: 'roller',
	label: 'Pocket Sand',
	ruleId: 'rule-1',
	itemUuid: 'Item.sand',
	used: false,
	outcomeTrigger: 'always',
} satisfies IncomingReactionEntry;

const REPLACED: ReplacedRoll = {
	originalFormula: '1d8 + 2',
	isCritical: false,
	options: { rollMode: 0, primaryDieModifier: 1 },
};

function rule(overrides: Partial<RerollRuleLike> = {}): RerollRuleLike {
	return {
		type: 'reroll',
		id: 'rule-1',
		discardedCritTriggers: false,
		rerollCost: cost(),
		rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
		...overrides,
	};
}

type Roll = {
	primaryDieValue?: number;
	primaryDie?: { faces: number };
	isCritical?: boolean;
	isMiss?: boolean;
};

function input(overrides: Partial<RerollStepInput<Roll>> = {}): RerollStepInput<Roll> {
	return {
		rule: rule(),
		entry: ENTRY,
		rollKind: 'attack',
		payer: makeActor() as unknown as Actor,
		replaced: REPLACED,
		previousResult: 7,
		makeRoll: vi.fn(async () => ({ primaryDieValue: 3 })),
		earlierCritTriggers: false,
		...overrides,
	};
}

describe('rerollWithRule', () => {
	beforeEach(() => {
		testGlobals.game.settings = { get: () => true };
	});
	afterEach(() => {
		delete testGlobals.game.settings;
		testGlobals.game.combat = null;
	});

	it('rolls again with the rule changes on top of the replaced roll', async () => {
		const makeRoll = vi.fn(async () => ({ primaryDieValue: 3 }));
		const changes = { rollModeChange: -1, primaryDieBonus: 2, extraDamage: '1d6' };

		const result = await rerollWithRule(
			input({ rule: rule({ rerollChanges: () => changes }), makeRoll }),
		);

		expect(makeRoll).toHaveBeenCalledWith(
			'1d8 + 2 + (1d6)',
			{
				rollMode: 0,
				rollModeSources: [0, -1],
				primaryDieModifier: 3,
			},
			changes,
		);
		expect(result).toMatchObject({ status: 'done', roll: { primaryDieValue: 3 } });
	});

	it("adds the roll mode changes of two Modify Reroll rules to the rule's own", async () => {
		const makeRoll = vi.fn(async () => ({ primaryDieValue: 3 }));
		const advantage = (key: string) => ({ key, kind: 'rollMode' as const, label: key, value: 1 });

		await rerollWithRule(
			input({
				rule: rule({
					rerollChanges: () => ({ rollModeChange: 1, primaryDieBonus: 0, extraDamage: '' }),
				}),
				rollChanges: [advantage('a'), advantage('b')],
				makeRoll,
			}),
		);

		expect(makeRoll).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ rollModeSources: [0, 3] }),
			expect.objectContaining({ rollModeChange: 3 }),
		);
	});

	it('asks the rule for the changes of the kind of roll it rerolls', async () => {
		const rerollChanges = vi.fn(() => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }));
		await rerollWithRule(input({ rule: rule({ rerollChanges }), rollKind: 'save' }));
		await rerollWithRule(input({ rule: rule({ rerollChanges }) }));
		expect(rerollChanges.mock.calls).toEqual([['save'], ['attack']]);
	});

	it('reads the formula of a serialized roll that has no original formula', async () => {
		const makeRoll = vi.fn(async () => ({}));
		await rerollWithRule(input({ replaced: { formula: '2d6', options: {} }, makeRoll }));
		expect(makeRoll).toHaveBeenCalledWith('2d6', expect.any(Object), expect.any(Object));
	});

	it('pays the cost and keeps the history of the reroll', async () => {
		const payer = makeActor({ charges: 2, wounds: 1 });
		const result = await rerollWithRule(
			input({
				payer: payer as unknown as Actor,
				rule: rule({ rerollCost: cost({ chargePoolIdentifier: 'sand', woundCost: 1 }) }),
				replaced: { ...REPLACED, isCritical: true },
			}),
		);

		expect(payer.system.attributes.wounds.value).toBe(2);
		expect(result).toMatchObject({
			status: 'done',
			reroll: {
				entryId: 'entry-1',
				itemUuid: 'Item.sand',
				ruleId: 'rule-1',
				label: 'Pocket Sand',
				actorUuid: 'Actor.hero',
				previous: { value: 7, outcome: 'crit' },
				next: { value: 3, outcome: null },
				usesLeft: 1,
				woundsGained: 1,
			},
		});
	});

	it('records the die size and whether each result was a crit or a miss', async () => {
		const result = await rerollWithRule(
			input({
				replaced: { ...REPLACED, isMiss: true },
				previousResult: 1,
				makeRoll: vi.fn(async () => ({
					primaryDieValue: 8,
					primaryDie: { faces: 8 },
					isCritical: true,
				})),
			}),
		);

		expect(result).toMatchObject({
			reroll: {
				faces: 8,
				previous: { value: 1, outcome: 'miss' },
				next: { value: 8, outcome: 'crit' },
			},
		});
	});

	it('takes the new die from the caller when it reads it', async () => {
		const newRoll: Roll = { isCritical: false };
		const readNewDie = vi.fn(() => ({ faces: 20, value: 14 }));
		const result = await rerollWithRule(
			input({ makeRoll: vi.fn(async () => newRoll), readNewDie }),
		);

		expect(readNewDie).toHaveBeenCalledWith(newRoll);
		expect(result).toMatchObject({ reroll: { faces: 20, next: { value: 14, outcome: null } } });
	});

	it('records a change: how the die changed and its new face', async () => {
		const result = await rerollWithRule(
			input({
				rule: rule({ type: 'changeDie', rerollChanges: undefined }),
				change: { mode: 'set', amount: 0 },
				makeRoll: vi.fn(async () => ({ isCritical: true })),
				readNewDie: () => ({ faces: 8, value: 8 }),
			}),
		);

		expect(result).toMatchObject({
			reroll: {
				use: 'change',
				change: { mode: 'set', amount: 0 },
				previous: { value: 7, outcome: null },
				next: { value: 8, outcome: 'crit' },
				changes: [],
			},
		});
	});

	it('records no use or change for a reroll', async () => {
		const result = await rerollWithRule(input());
		if (result.status !== 'done') throw new Error('expected a reroll');
		expect(result.reroll).not.toHaveProperty('use');
		expect(result.reroll).not.toHaveProperty('change');
	});

	it('records no new die when the caller reads none', async () => {
		const result = await rerollWithRule(input({ readNewDie: () => ({ faces: 20, value: null }) }));
		expect(result).toMatchObject({ reroll: { faces: 20, next: null } });
	});

	it('records no die when it cannot be read', async () => {
		const result = await rerollWithRule(
			input({ previousResult: null, makeRoll: vi.fn(async () => ({})) }),
		);

		expect(result).toMatchObject({ reroll: { faces: null, previous: null, next: null } });
	});

	it('passes the pay options on, such as a forced heroic reaction', async () => {
		const payer = makeActor();
		const combatant = {
			id: 'combatant-1',
			actor: payer,
			system: { actions: { base: { current: 1 } } },
		};
		const useHeroicReactions = vi.fn(async () => true);
		testGlobals.game.combat = {
			id: 'combat-1',
			started: true,
			combatants: { find: (match: (c: unknown) => boolean) => [combatant].find(match) },
			useHeroicReactions,
		};

		await rerollWithRule(
			input({
				payer: payer as unknown as Actor,
				rule: rule({ rerollCost: cost({ heroicReaction: 'defend' }) }),
				payOptions: { forceHeroicReaction: true },
			}),
		);

		expect(useHeroicReactions).toHaveBeenCalledWith('combatant-1', ['defend'], { force: true });
	});

	it('makes no roll when the cost cannot be paid', async () => {
		const makeRoll = vi.fn(async () => ({}));
		const result = await rerollWithRule(
			input({ rule: rule({ rerollCost: cost({ manaCost: 2 }) }), makeRoll }),
		);
		expect(result).toEqual({ status: 'unpaid' });
		expect(makeRoll).not.toHaveBeenCalled();
	});

	it('gives the cost back when the new roll fails', async () => {
		const payer = makeActor({ mana: 2 });
		const error = new Error('roll failed');
		const result = await rerollWithRule(
			input({
				payer: payer as unknown as Actor,
				rule: rule({ rerollCost: cost({ manaCost: 2 }) }),
				makeRoll: vi.fn(async () => {
					throw error;
				}),
			}),
		);
		expect(result).toEqual({ status: 'failed', error });
		expect(payer.system.resources.mana.current).toBe(2);
	});

	it('gives the cost back later, when the caller cannot use the new roll', async () => {
		const payer = makeActor({ mana: 2, wounds: 1 });
		const result = await rerollWithRule(
			input({
				payer: payer as unknown as Actor,
				rule: rule({ rerollCost: cost({ manaCost: 2, woundCost: 1 }) }),
			}),
		);
		if (result.status !== 'done') throw new Error('expected a reroll');
		expect(payer.system.resources.mana.current).toBe(0);
		expect(payer.system.attributes.wounds.value).toBe(2);

		await result.refund();

		expect(payer.system.resources.mana.current).toBe(2);
		expect(payer.system.attributes.wounds.value).toBe(1);
	});

	it('has nothing to give back for a reroll with no cost', async () => {
		const payer = makeActor();
		const result = await rerollWithRule(
			input({ payer: payer as unknown as Actor, rule: rule({ rerollCost: undefined }) }),
		);
		if (result.status !== 'done') throw new Error('expected a reroll');
		await result.refund();
		expect(payer.update).not.toHaveBeenCalled();
	});

	it('places the new roll, and gives the cost back when placing it fails', async () => {
		const payer = makeActor({ mana: 2 });
		const place = vi.fn(async () => {
			throw new Error('write failed');
		});
		const result = await rerollWithRule(
			input({
				payer: payer as unknown as Actor,
				rule: rule({ rerollCost: cost({ manaCost: 2 }) }),
				place,
			}),
		);
		expect(place).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'done', roll: { primaryDieValue: 3 } }),
		);
		expect(result.status).toBe('failed');
		expect(payer.system.resources.mana.current).toBe(2);
	});

	it.each([
		[false, false, false, false],
		[false, true, false, false],
		[false, false, true, false],
		[false, true, true, true],
		[true, false, false, true],
		[true, true, true, true],
	])(
		'with an earlier kept crit %s, the rule keeping crits %s and a crit replaced %s, crit triggers stay %s',
		async (earlierCritTriggers, keepsCrits, wasCritical, expected) => {
			const result = await rerollWithRule(
				input({
					earlierCritTriggers,
					rule: rule({ discardedCritTriggers: keepsCrits }),
					replaced: { ...REPLACED, isCritical: wasCritical },
				}),
			);
			expect(result).toMatchObject({ discardedCritTriggers: expected });
		},
	);
});
