import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	canPayRerollCost,
	findActorCombatant,
	payRerollCost,
	type RerollCost,
	refundRerollCost,
	rerollCostCharges,
	rerollUsesLeft,
} from '../rerollCost.js';

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
		actor,
		system: { actions: { base: { current: 3 } } },
	};
	const combat = {
		id: 'combat-1',
		started: true,
		round: 1,
		combatants: { find: (predicate: (c: unknown) => boolean) => [combatant].find(predicate) },
		useHeroicReactions: vi.fn(async () => used),
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

	describe('canPayRerollCost', () => {
		it('pays a free cost', () => {
			expect(canPayRerollCost(makeActor().asActor, cost())).toBe(true);
		});

		it('needs enough charges in the named pool', () => {
			const charges = cost({ chargePoolIdentifier: 'sand', chargeCost: 2 });
			expect(canPayRerollCost(makeActor({ charges: 1 }).asActor, charges)).toBe(false);
			expect(canPayRerollCost(makeActor({ charges: 2 }).asActor, charges)).toBe(true);
			expect(
				canPayRerollCost(makeActor({ charges: 2 }).asActor, cost({ chargePoolIdentifier: 'fury' })),
			).toBe(false);
		});

		it('needs enough mana', () => {
			expect(canPayRerollCost(makeActor({ mana: 1 }).asActor, cost({ manaCost: 2 }))).toBe(false);
			expect(canPayRerollCost(makeActor({ mana: 2 }).asActor, cost({ manaCost: 2 }))).toBe(true);
		});

		it('needs room for every Wound the cost gives', () => {
			const twoWounds = cost({ woundCost: 2 });
			expect(canPayRerollCost(makeActor({ wounds: 4, maxWounds: 6 }).asActor, twoWounds)).toBe(
				true,
			);
			expect(canPayRerollCost(makeActor({ wounds: 5, maxWounds: 6 }).asActor, twoWounds)).toBe(
				false,
			);
			expect(canPayRerollCost(makeActor({ wounds: 6, maxWounds: 6 }).asActor, twoWounds)).toBe(
				false,
			);
		});

		it('pays anything while resource spending automation is off', () => {
			setToggles({ 'automation.resourceSpending': false });
			expect(
				canPayRerollCost(
					makeActor({ wounds: 6, maxWounds: 6 }).asActor,
					cost({ chargePoolIdentifier: 'sand', manaCost: 9, woundCost: 1 }),
				),
			).toBe(true);
		});
	});

	describe('rerollUsesLeft', () => {
		it('counts uses, not charges', () => {
			const twoCharges = cost({ chargePoolIdentifier: 'sand', chargeCost: 2 });
			expect(rerollUsesLeft(makeActor({ charges: 2 }).asActor, twoCharges)).toBe(1);
			expect(rerollUsesLeft(makeActor({ charges: 1 }).asActor, twoCharges)).toBe(0);
			expect(
				rerollUsesLeft(makeActor({ charges: 2 }).asActor, cost({ chargePoolIdentifier: 'sand' })),
			).toBe(2);
		});

		it('is null without a charge pool', () => {
			expect(rerollUsesLeft(makeActor({ charges: 2 }).asActor, cost())).toBeNull();
		});
	});

	describe('rerollCostCharges', () => {
		it('is true for any part that charges, and only for a heroic reaction with spending off', () => {
			expect(rerollCostCharges(cost())).toBe(false);
			expect(rerollCostCharges(cost({ woundCost: 1 }))).toBe(true);
			expect(rerollCostCharges(cost({ heroicReaction: 'defend' }))).toBe(true);
			setToggles({ 'automation.resourceSpending': false });
			expect(rerollCostCharges(cost({ woundCost: 1 }))).toBe(false);
			expect(rerollCostCharges(cost({ heroicReaction: 'defend' }))).toBe(true);
		});
	});

	describe('payRerollCost', () => {
		it('spends charges, mana and Wounds', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 3, wounds: 1 });
			const paid = await payRerollCost(
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
			const paid = await payRerollCost(
				asActor,
				cost({ chargePoolIdentifier: 'sand', woundCost: 2 }),
			);
			expect(paid).toBeNull();
			expect(item.flags.nimble.chargePools.sand.current).toBe(2);
			expect(actor.system.attributes.wounds.value).toBe(5);
		});

		it('gives back what it charged when a later part cannot be paid', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 0 });
			const paid = await payRerollCost(
				asActor,
				cost({ chargePoolIdentifier: 'sand', manaCost: 1 }),
			);

			expect(paid).toBeNull();
			expect(item.flags.nimble.chargePools.sand.current).toBe(2);
			expect(actor.system.resources.mana.current).toBe(0);
		});

		it('refuses when the pool is empty', async () => {
			const { asActor } = makeActor({ charges: 0 });
			await expect(
				payRerollCost(asActor, cost({ chargePoolIdentifier: 'sand' })),
			).resolves.toBeNull();
		});

		it('charges nothing while resource spending automation is off', async () => {
			setToggles({ 'automation.resourceSpending': false });
			const { actor, item, asActor } = makeActor({ charges: 0, wounds: 0 });
			const paid = await payRerollCost(
				asActor,
				cost({ chargePoolIdentifier: 'sand', woundCost: 1 }),
			);

			expect(paid).toEqual({ charges: 0, mana: 0, wounds: 0, heroicReaction: null, action: null });
			expect(item.update).not.toHaveBeenCalled();
			expect(actor.update).not.toHaveBeenCalled();
		});

		it('still uses the heroic reaction while resource spending automation is off', async () => {
			setToggles({ 'automation.resourceSpending': false });
			const { actor, asActor } = makeActor({ wounds: 0 });
			const combat = makeCombat(asActor);
			const paid = await payRerollCost(asActor, cost({ heroicReaction: 'defend', woundCost: 1 }));

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
			const paid = await payRerollCost(asActor, cost({ heroicReaction: 'defend' }), {
				forceHeroicReaction: true,
			});

			expect(combat.useHeroicReactions).toHaveBeenCalledWith('combatant-1', ['defend'], {
				force: true,
			});
			expect(paid?.heroicReaction).toEqual({
				combatId: 'combat-1',
				combatantId: 'combatant-1',
				key: 'defend',
				previousActions: 3,
			});
		});

		it('refuses when the combat refuses the heroic reaction', async () => {
			const { asActor } = makeActor();
			makeCombat(asActor, false);
			await expect(payRerollCost(asActor, cost({ heroicReaction: 'defend' }))).resolves.toBeNull();
		});

		it('costs no heroic reaction out of combat', async () => {
			const { asActor } = makeActor();
			testGlobals.game.combat = null;
			await expect(payRerollCost(asActor, cost({ heroicReaction: 'defend' }))).resolves.toEqual({
				charges: 0,
				mana: 0,
				wounds: 0,
				heroicReaction: null,
				action: null,
			});
		});
	});

	describe('refundRerollCost', () => {
		it('gives back charges, mana, Wounds and the heroic reaction', async () => {
			const { actor, item, asActor } = makeActor({ charges: 2, mana: 3, wounds: 1 });
			const combat = makeCombat(asActor);
			const full = cost({
				chargePoolIdentifier: 'sand',
				manaCost: 2,
				woundCost: 1,
				heroicReaction: 'defend',
			});
			const paid = await payRerollCost(asActor, full);
			if (!paid) throw new Error('expected the cost to be paid');

			await refundRerollCost(asActor, full, paid);

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
	});

	describe('action cost', () => {
		const action = cost({ actionCost: 1 });

		it("needs an action left on the owner's own turn", () => {
			const { asActor } = makeActor();
			makeActionCombat(asActor, { ownTurn: true, actions: 0 });
			expect(canPayRerollCost(asActor, action)).toBe(false);
			makeActionCombat(asActor, { ownTurn: true, actions: 1 });
			expect(canPayRerollCost(asActor, action)).toBe(true);
		});

		it("can always be paid off the owner's turn, out of combat and with spending off", () => {
			const { asActor } = makeActor();
			makeActionCombat(asActor, { ownTurn: false, actions: 0 });
			expect(canPayRerollCost(asActor, action)).toBe(true);
			testGlobals.game.combat = null;
			expect(canPayRerollCost(asActor, action)).toBe(true);
			makeActionCombat(asActor, { ownTurn: true, actions: 0 });
			setToggles({ 'automation.resourceSpending': false });
			expect(canPayRerollCost(asActor, action)).toBe(true);
		});

		it('charges something only while resource spending automation is on', () => {
			expect(rerollCostCharges(action)).toBe(true);
			setToggles({ 'automation.resourceSpending': false });
			expect(rerollCostCharges(action)).toBe(false);
		});

		it("spends an action now on the owner's own turn, and gives it back", async () => {
			const { asActor } = makeActor();
			const combatant = makeActionCombat(asActor, { ownTurn: true, actions: 2 });
			const paid = await payRerollCost(asActor, action);
			expect(combatant.system.actions.base.current).toBe(1);
			expect(combatant.system.actions.pendingDelta).toBe(0);
			if (!paid) throw new Error('expected the cost to be paid');
			await refundRerollCost(asActor, action, paid);
			expect(combatant.system.actions.base.current).toBe(2);
		});

		it("takes an action from the next turn off the owner's turn, and gives it back", async () => {
			const { asActor } = makeActor();
			const combatant = makeActionCombat(asActor, { ownTurn: false, actions: 3 });
			const paid = await payRerollCost(asActor, action);
			expect(combatant.system.actions.base.current).toBe(3);
			expect(combatant.system.actions.pendingDelta).toBe(-1);
			if (!paid) throw new Error('expected the cost to be paid');
			await refundRerollCost(asActor, action, paid);
			expect(combatant.system.actions.pendingDelta).toBe(0);
		});

		it('spends nothing out of combat or with spending off', async () => {
			const { asActor } = makeActor();
			expect(await payRerollCost(asActor, action)).toMatchObject({ action: null });
			const combatant = makeActionCombat(asActor, { ownTurn: true, actions: 2 });
			setToggles({ 'automation.resourceSpending': false });
			await payRerollCost(asActor, action);
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
});
