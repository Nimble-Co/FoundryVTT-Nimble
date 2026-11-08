import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { giveBack, payCost } from '../costLedger.js';
import {
	canPayUseCost,
	costUsesLeft,
	findActorCombatant,
	type UseCost,
	useCostCharges,
} from '../useCost.js';

const testGlobals = globalThis as unknown as {
	game: {
		settings?: { get: (scope: string, key: string) => unknown };
		combat?: unknown;
		user?: { isGM: boolean };
	};
};

function setToggles(toggles: Record<string, boolean>): void {
	testGlobals.game.settings = { get: (_scope, key) => toggles[key] ?? true };
}

function cost(overrides: Partial<UseCost> = {}): UseCost {
	return {
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		...overrides,
	};
}

function makeActor(
	options: { charges?: number; mana?: number; wounds?: number; maxWounds?: number } = {},
) {
	const item = {
		id: 'item-1',
		name: 'Pocket Sand',
		flags: { nimble: { chargePools: { sand: { current: options.charges ?? 0, max: 2 } } } },
		rules: new Map([
			[
				'rule-1',
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
			attributes: { wounds: { value: options.wounds ?? 0, max: options.maxWounds ?? 6 } },
		},
		getRollData: () => ({}),
		items: { contents: [item], get: (id: string) => (id === item.id ? item : undefined) },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return { actor, item, asActor: actor as unknown as Actor };
}

function makeCombat(actor: unknown, used = true) {
	const combatant = {
		id: 'combatant-1',
		type: 'character',
		actor,
		system: { actions: { base: { current: 3, max: 3 } } },
	};
	const combat = {
		id: 'combat-1',
		started: true,
		round: 1,
		combatants: {
			find: (predicate: (c: unknown) => boolean) => [combatant].find(predicate),
			get: (id: string) => (id === combatant.id ? combatant : undefined),
		},
		combatant,
		useHeroicReactions: vi.fn(async () => {
			if (used) combatant.system.actions.base.current -= 1;
			return used;
		}),
		updateEmbeddedDocuments: vi.fn(async () => undefined),
	};
	testGlobals.game.combat = combat;
	return combat;
}

/** A started combat with one character combatant and the turn on it or on someone else. */
function makeActionCombat(actor: unknown, options: { ownTurn: boolean; actions?: number }) {
	const combatant = {
		id: 'combatant-1',
		type: 'character',
		actor,
		system: { actions: { base: { current: options.actions ?? 3, max: 3 }, pendingDelta: 0 } },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(combatant, path, value);
			}
		}),
	};
	const other = { id: 'combatant-2', type: 'npc' };
	const list = [combatant, other];
	const combat = {
		id: 'combat-1',
		started: true,
		round: 1,
		combatant: options.ownTurn ? combatant : other,
		combatants: {
			find: (predicate: (c: unknown) => boolean) => list.find(predicate),
			get: (id: string) => list.find((c) => c.id === id),
		},
		useHeroicReactions: vi.fn(async () => true),
		updateEmbeddedDocuments: vi.fn(async () => undefined),
	};
	testGlobals.game.combat = combat;
	testGlobals.game.user = { isGM: true };
	return combatant;
}

describe('rerollCost', () => {
	beforeEach(() => setToggles({}));
	afterEach(() => {
		delete testGlobals.game.settings;
		testGlobals.game.combat = null;
	});

	describe('canPayUseCost', () => {
		it('pays a free cost', () => {
			expect(canPayUseCost(makeActor().asActor, cost())).toBe(true);
		});

		it('needs enough charges in the named pool', () => {
			const charges = cost({ chargePoolIdentifier: 'sand', chargeCost: 2 });
			expect(canPayUseCost(makeActor({ charges: 1 }).asActor, charges)).toBe(false);
			expect(canPayUseCost(makeActor({ charges: 2 }).asActor, charges)).toBe(true);
			expect(
				canPayUseCost(makeActor({ charges: 2 }).asActor, cost({ chargePoolIdentifier: 'fury' })),
			).toBe(false);
		});

		it('needs enough mana', () => {
			expect(canPayUseCost(makeActor({ mana: 1 }).asActor, cost({ manaCost: 2 }))).toBe(false);
			expect(canPayUseCost(makeActor({ mana: 2 }).asActor, cost({ manaCost: 2 }))).toBe(true);
		});

		it('needs room for every Wound the cost gives', () => {
			const twoWounds = cost({ woundCost: 2 });
			expect(canPayUseCost(makeActor({ wounds: 4, maxWounds: 6 }).asActor, twoWounds)).toBe(true);
			expect(canPayUseCost(makeActor({ wounds: 5, maxWounds: 6 }).asActor, twoWounds)).toBe(false);
			expect(canPayUseCost(makeActor({ wounds: 6, maxWounds: 6 }).asActor, twoWounds)).toBe(false);
		});

		it('pays anything while resource spending automation is off', () => {
			setToggles({ 'automation.resourceSpending': false });
			expect(
				canPayUseCost(
					makeActor({ wounds: 6, maxWounds: 6 }).asActor,
					cost({ chargePoolIdentifier: 'sand', manaCost: 9, woundCost: 1 }),
				),
			).toBe(true);
		});
	});

	describe('costUsesLeft', () => {
		it('counts uses, not charges', () => {
			const twoCharges = cost({ chargePoolIdentifier: 'sand', chargeCost: 2 });
			expect(costUsesLeft(makeActor({ charges: 2 }).asActor, twoCharges)).toBe(1);
			expect(costUsesLeft(makeActor({ charges: 1 }).asActor, twoCharges)).toBe(0);
			expect(
				costUsesLeft(makeActor({ charges: 2 }).asActor, cost({ chargePoolIdentifier: 'sand' })),
			).toBe(2);
		});

		it('is null without a charge pool', () => {
			expect(costUsesLeft(makeActor({ charges: 2 }).asActor, cost())).toBeNull();
		});
	});

	describe('useCostCharges', () => {
		it('is true for any part that charges, and only for a heroic reaction with spending off', () => {
			expect(useCostCharges(cost())).toBe(false);
			expect(useCostCharges(cost({ woundCost: 1 }))).toBe(true);
			expect(useCostCharges(cost({ heroicReaction: 'defend' }))).toBe(true);
			setToggles({ 'automation.resourceSpending': false });
			expect(useCostCharges(cost({ woundCost: 1 }))).toBe(false);
			expect(useCostCharges(cost({ heroicReaction: 'defend' }))).toBe(true);
		});
	});

	describe('payCost', () => {
		it('spends charges, mana and Wounds', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 3, wounds: 1 });
			const paid = await payCost(
				asActor,
				cost({ chargePoolIdentifier: 'sand', manaCost: 2, woundCost: 1 }),
			);

			expect(paid).toEqual({ charges: 1, mana: 2, wounds: 1, heroicReaction: null, action: null });
			expect(item.flags.nimble.chargePools.sand.current).toBe(1);
			expect(actor.system.resources.mana.current).toBe(1);
			expect(actor.system.attributes.wounds.value).toBe(2);
		});

		it('refuses, and gives back what it charged, when the Wounds would pass the maximum', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, wounds: 5, maxWounds: 6 });
			const paid = await payCost(asActor, cost({ chargePoolIdentifier: 'sand', woundCost: 2 }));
			expect(paid).toBeNull();
			expect(item.flags.nimble.chargePools.sand.current).toBe(2);
			expect(actor.system.attributes.wounds.value).toBe(5);
		});

		it('gives back what it charged when a later part cannot be paid', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 0 });
			const paid = await payCost(asActor, cost({ chargePoolIdentifier: 'sand', manaCost: 1 }));

			expect(paid).toBeNull();
			expect(item.flags.nimble.chargePools.sand.current).toBe(2);
			expect(actor.system.resources.mana.current).toBe(0);
		});

		it('refuses when the pool is empty', async () => {
			const { asActor } = makeActor({ charges: 0 });
			await expect(payCost(asActor, cost({ chargePoolIdentifier: 'sand' }))).resolves.toBeNull();
		});

		it('charges nothing while resource spending automation is off', async () => {
			setToggles({ 'automation.resourceSpending': false });
			const { actor, item, asActor } = makeActor({ charges: 0, wounds: 0 });
			const paid = await payCost(asActor, cost({ chargePoolIdentifier: 'sand', woundCost: 1 }));

			expect(paid).toEqual({ charges: 0, mana: 0, wounds: 0, heroicReaction: null, action: null });
			expect(item.update).not.toHaveBeenCalled();
			expect(actor.update).not.toHaveBeenCalled();
		});

		it('still uses the heroic reaction while resource spending automation is off', async () => {
			setToggles({ 'automation.resourceSpending': false });
			const { actor, asActor } = makeActor({ wounds: 0 });
			const combat = makeCombat(asActor);
			const paid = await payCost(asActor, cost({ heroicReaction: 'defend', woundCost: 1 }));

			expect(combat.useHeroicReactions).toHaveBeenCalledWith('combatant-1', ['defend'], {
				force: false,
			});
			expect(paid?.heroicReaction).toMatchObject({ key: 'defend' });
			expect(paid?.wounds).toBe(0);
			expect(actor.update).not.toHaveBeenCalled();
		});

		it('uses the heroic reaction in combat', async () => {
			const { asActor } = makeActor();
			const combat = makeCombat(asActor);
			const paid = await payCost(asActor, cost({ heroicReaction: 'defend' }), {
				forceHeroicReaction: true,
			});

			expect(combat.useHeroicReactions).toHaveBeenCalledWith('combatant-1', ['defend'], {
				force: true,
			});
			expect(paid?.heroicReaction).toEqual({
				combatId: 'combat-1',
				combatantId: 'combatant-1',
				key: 'defend',
				actionsSpent: 1,
			});
		});

		it('refuses when the combat refuses the heroic reaction', async () => {
			const { asActor } = makeActor();
			makeCombat(asActor, false);
			await expect(payCost(asActor, cost({ heroicReaction: 'defend' }))).resolves.toBeNull();
		});

		it('costs no heroic reaction out of combat', async () => {
			const { asActor } = makeActor();
			testGlobals.game.combat = null;
			await expect(payCost(asActor, cost({ heroicReaction: 'defend' }))).resolves.toEqual({
				charges: 0,
				mana: 0,
				wounds: 0,
				heroicReaction: null,
				action: null,
			});
		});
	});

	describe('giveBack', () => {
		it('gives back charges, mana, Wounds and the heroic reaction', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 3, wounds: 1 });
			const combat = makeCombat(asActor);
			const full = cost({
				chargePoolIdentifier: 'sand',
				manaCost: 2,
				woundCost: 1,
				heroicReaction: 'defend',
			});
			const paid = await payCost(asActor, full);
			if (!paid) throw new Error('expected the cost to be paid');

			await giveBack(asActor, { cost: full, paid: paid });

			expect(item.flags.nimble.chargePools.sand.current).toBe(2);
			expect(actor.system.resources.mana.current).toBe(3);
			expect(actor.system.attributes.wounds.value).toBe(1);
			expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
				{
					_id: 'combatant-1',
					'system.actions.base.current': 3,
					'system.actions.heroic.defendAvailable': true,
				},
			]);
		});

		it('gives back only the actions the heroic reaction spent, not later spends', async () => {
			const { asActor } = makeActor();
			const combat = makeCombat(asActor);
			const reaction = cost({ heroicReaction: 'defend' });
			const paid = await payCost(asActor, reaction);
			if (!paid) throw new Error('expected the cost to be paid');
			combat.combatant.system.actions.base.current = 0;

			await giveBack(asActor, { cost: reaction, paid: paid });

			expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
				{
					_id: 'combatant-1',
					'system.actions.base.current': 1,
					'system.actions.heroic.defendAvailable': true,
				},
			]);
		});
	});

	describe('action cost', () => {
		const action = cost({ actionCost: 1 });

		it("needs an action left on the owner's own turn", () => {
			const { asActor } = makeActor();
			makeActionCombat(asActor, { ownTurn: true, actions: 0 });
			expect(canPayUseCost(asActor, action)).toBe(false);
			makeActionCombat(asActor, { ownTurn: true, actions: 1 });
			expect(canPayUseCost(asActor, action)).toBe(true);
		});

		it("can always be paid off the owner's turn, out of combat and with spending off", () => {
			const { asActor } = makeActor();
			makeActionCombat(asActor, { ownTurn: false, actions: 0 });
			expect(canPayUseCost(asActor, action)).toBe(true);
			testGlobals.game.combat = null;
			expect(canPayUseCost(asActor, action)).toBe(true);
			makeActionCombat(asActor, { ownTurn: true, actions: 0 });
			setToggles({ 'automation.resourceSpending': false });
			expect(canPayUseCost(asActor, action)).toBe(true);
		});

		it('charges something only while resource spending automation is on', () => {
			expect(useCostCharges(action)).toBe(true);
			setToggles({ 'automation.resourceSpending': false });
			expect(useCostCharges(action)).toBe(false);
		});

		it("spends an action now on the owner's own turn, and gives it back", async () => {
			const { asActor } = makeActor();
			const combatant = makeActionCombat(asActor, { ownTurn: true, actions: 2 });
			const paid = await payCost(asActor, action);
			expect(combatant.system.actions.base.current).toBe(1);
			expect(combatant.system.actions.pendingDelta).toBe(0);
			if (!paid) throw new Error('expected the cost to be paid');
			await giveBack(asActor, { cost: action, paid: paid });
			expect(combatant.system.actions.base.current).toBe(2);
		});

		it("takes an action from the next turn off the owner's turn, and gives it back", async () => {
			const { asActor } = makeActor();
			const combatant = makeActionCombat(asActor, { ownTurn: false, actions: 3 });
			const paid = await payCost(asActor, action);
			expect(combatant.system.actions.base.current).toBe(3);
			expect(combatant.system.actions.pendingDelta).toBe(-1);
			if (!paid) throw new Error('expected the cost to be paid');
			await giveBack(asActor, { cost: action, paid: paid });
			expect(combatant.system.actions.pendingDelta).toBe(0);
		});

		it('spends nothing out of combat or with spending off', async () => {
			const { asActor } = makeActor();
			expect(await payCost(asActor, action)).toMatchObject({ action: null });
			const combatant = makeActionCombat(asActor, { ownTurn: true, actions: 2 });
			setToggles({ 'automation.resourceSpending': false });
			await payCost(asActor, action);
			expect(combatant.update).not.toHaveBeenCalled();
		});
	});

	describe('findActorCombatant', () => {
		it('finds the combatant of the actor itself', () => {
			const { actor, asActor } = makeActor();
			const combat = makeCombat(actor);

			const found = findActorCombatant(asActor);

			expect(found?.combat).toBe(combat);
			expect(found?.combatant.id).toBe('combatant-1');
		});

		it('finds the combatant of another copy of the same actor by its uuid', () => {
			const { asActor } = makeActor();
			makeCombat({ uuid: 'Actor.hero' });

			expect(findActorCombatant(asActor)?.combatant.id).toBe('combatant-1');
		});

		it('finds nothing for an actor that is not in the combat', () => {
			const { asActor } = makeActor();
			makeCombat({ uuid: 'Actor.someone-else' });

			expect(findActorCombatant(asActor)).toBeNull();
		});

		it('finds nothing before the combat starts', () => {
			const { actor, asActor } = makeActor();
			Object.assign(makeCombat(actor), { started: false });

			expect(findActorCombatant(asActor)).toBeNull();
		});

		it('finds nothing outside combat', () => {
			testGlobals.game.combat = null;

			expect(findActorCombatant(makeActor().asActor)).toBeNull();
		});

		it('finds nothing for no actor', () => {
			makeCombat(makeActor().actor);

			expect(findActorCombatant(null)).toBeNull();
		});
	});

	describe('dice pool cost', () => {
		type StoredPool = { faces: number[]; max: number; dieSize: string };
		function judgmentActor(faces: number[]) {
			const item = {
				id: 'item-judgment',
				name: 'Radiant Judgment',
				flags: {
					[SYSTEM_ID]: { dicePools: { judgment: { faces, max: 3, dieSize: 'd6' } as StoredPool } },
				},
				rules: new Map([
					[
						'rule-1',
						{
							type: 'dicePool',
							disabled: false,
							id: 'judgment-pool-base',
							identifier: 'judgment',
							label: 'Judgment Dice',
							scope: 'item',
							dieSize: 'd6',
							max: '3',
							initial: 'zero',
							refills: [],
						},
					],
				]),
				update: vi.fn(async (changes: Record<string, unknown>) => {
					const pools = changes[`flags.${SYSTEM_ID}.dicePools`] as Record<string, StoredPool>;
					item.flags[SYSTEM_ID].dicePools.judgment = { ...pools.judgment };
				}),
			};
			const actor = {
				type: 'character',
				flags: {},
				getRollData: () => ({}),
				items: { contents: [item] },
				update: vi.fn(async () => undefined),
			};
			return { item, asActor: actor as unknown as Actor };
		}
		const expend = cost({ dicePoolIdentifier: 'judgment' });

		it('needs at least one die in the pool', () => {
			expect(canPayUseCost(judgmentActor([4]).asActor, expend)).toBe(true);
			expect(canPayUseCost(judgmentActor([]).asActor, expend)).toBe(false);
		});

		it('expends every die of the pool, and gives them back', async () => {
			const { item, asActor } = judgmentActor([4, 6]);
			const paid = await payCost(asActor, expend);
			expect(item.flags[SYSTEM_ID].dicePools.judgment.faces).toEqual([]);
			if (!paid) throw new Error('expected the cost to be paid');

			await giveBack(asActor, { cost: expend, paid: paid });
			expect(item.flags[SYSTEM_ID].dicePools.judgment.faces).toEqual([4, 6]);
		});
	});
});
