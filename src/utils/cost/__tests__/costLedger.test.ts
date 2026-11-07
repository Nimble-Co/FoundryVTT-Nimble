import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { giveBack, payCost, receiptOf, spendMana } from '../costLedger.js';

const testGlobals = globalThis as unknown as {
	game: {
		settings?: { get: ReturnType<typeof vi.fn> };
		combat?: unknown;
		user?: { isGM: boolean };
	};
};

function caster(current: number) {
	const actor = {
		system: { resources: { mana: { current, max: 10 } } },
		update: vi.fn(async (changes: Record<string, number>) => {
			actor.system.resources.mana.current = changes['system.resources.mana.current'];
		}),
	};
	return actor;
}

function manaCost(manaCost: number) {
	return {
		chargePoolIdentifier: '',
		chargeCost: 0,
		manaCost,
		woundCost: 0,
		heroicReaction: '' as const,
	};
}

describe('cost ledger', () => {
	beforeEach(() => {
		testGlobals.game.settings = { get: vi.fn(() => true) };
	});
	afterEach(() => {
		testGlobals.game.settings = undefined;
	});

	it('takes Mana only when the caster has enough', async () => {
		const actor = caster(2);

		expect(await spendMana(actor as never, 3)).toBe(false);
		expect(actor.update).not.toHaveBeenCalled();
		expect(await spendMana(actor as never, 2)).toBe(true);
		expect(actor.system.resources.mana.current).toBe(0);
	});

	it('gives back the Mana a cost took', async () => {
		const actor = caster(5);
		const cost = manaCost(3);

		const paid = await payCost(actor as never, cost);
		expect(actor.system.resources.mana.current).toBe(2);
		await giveBack(actor as never, { cost, paid: paid! });

		expect(actor.system.resources.mana.current).toBe(5);
	});

	it('refuses a Mana cost the caster cannot pay', async () => {
		const actor = caster(1);

		expect(await payCost(actor as never, manaCost(3))).toBeNull();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('gives back nothing for a use that cost nothing', async () => {
		const actor = caster(5);
		await giveBack(actor as never, receiptOf());

		expect(actor.update).not.toHaveBeenCalled();
	});

	describe('an action or a heroic reaction', () => {
		/** A hero in a started combat on their own turn. The combatant writes its own updates. */
		function heroInCombat() {
			const actor = { uuid: 'Actor.hero' };
			const hero = {
				id: 'hero',
				type: 'character',
				actor,
				system: {
					actions: {
						base: { current: 3, max: 3 },
						pendingDelta: 0,
						heroic: { defendAvailable: true },
					},
				},
				update: vi.fn(async (changes: Record<string, unknown>) => {
					for (const [path, value] of Object.entries(changes)) {
						foundry.utils.setProperty(hero, path, value);
					}
				}),
			};
			const combat = {
				id: 'combat-1',
				started: true,
				round: 2,
				turn: 1,
				combatant: hero,
				combatants: {
					find: (predicate: (c: unknown) => boolean) => [hero].find(predicate),
					get: (id: string) => (id === hero.id ? hero : undefined),
				},
				useHeroicReactions: vi.fn(async () => {
					hero.system.actions.base.current -= 1;
					hero.system.actions.heroic.defendAvailable = false;
					return true;
				}),
				updateEmbeddedDocuments: vi.fn(
					async (_type: string, [update]: Array<Record<string, unknown>>) => {
						const { _id, ...changes } = update;
						await hero.update(changes);
					},
				),
			};
			testGlobals.game.combat = combat;
			testGlobals.game.user = { isGM: true };
			return { actor: actor as never, hero, combat };
		}

		const action = { ...manaCost(0), actionCost: 1 };
		const reaction = { ...manaCost(0), heroicReaction: 'defend' as const };

		afterEach(() => {
			testGlobals.game.combat = undefined;
		});

		it('stamps the combat, round and turn it was paid in', async () => {
			const { actor } = heroInCombat();

			const paid = await payCost(actor, action);

			expect(paid?.stamp).toEqual({ combatId: 'combat-1', round: 2, turn: 1 });
		});

		it('gives back an action in the same turn as a change, after another action is spent', async () => {
			const { actor, hero } = heroInCombat();
			const paid = await payCost(actor, action);
			hero.system.actions.base.current = 1;

			await giveBack(actor, { cost: action, paid: paid! });

			expect(hero.system.actions.base.current).toBe(2);
		});

		it('gives back a heroic reaction and its action in the same turn as a change', async () => {
			const { actor, hero } = heroInCombat();
			const paid = await payCost(actor, reaction);
			hero.system.actions.base.current = 0;

			await giveBack(actor, { cost: reaction, paid: paid! });

			expect(hero.system.actions.base.current).toBe(1);
			expect(hero.system.actions.heroic.defendAvailable).toBe(true);
		});

		it.each([
			['turn', { turn: 2 }],
			['round', { round: 3 }],
			['combat', { id: 'combat-2' }],
		])('gives back no action or heroic reaction after the %s changed', async (_name, moved) => {
			const { actor, hero, combat } = heroInCombat();
			const forAction = await payCost(actor, action);
			const forReaction = await payCost(actor, reaction);
			Object.assign(combat, moved);
			hero.update.mockClear();

			await giveBack(actor, { cost: action, paid: forAction! });
			await giveBack(actor, { cost: reaction, paid: forReaction! });

			expect(hero.update).not.toHaveBeenCalled();
			expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('gives back no action or heroic reaction for a record with no stamp, and the rest', async () => {
			const { actor, hero, combat } = heroInCombat();
			const mana = caster(5);
			const both = { ...action, heroicReaction: 'defend' as const, manaCost: 2 };
			Object.assign(actor, mana);
			const paid = await payCost(actor, both);
			const { stamp: _stamp, ...old } = paid!;
			hero.update.mockClear();

			await giveBack(actor, { cost: both, paid: old });

			expect(mana.system.resources.mana.current).toBe(5);
			expect(hero.update).not.toHaveBeenCalled();
			expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
