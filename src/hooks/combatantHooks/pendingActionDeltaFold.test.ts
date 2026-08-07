import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCombatantFixture } from '../../../tests/fixtures/combat.js';
import { flushAsync, getTestGlobals } from '../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
} from '../../../tests/mocks/combat.js';
import { buildCharacterTurnRefillUpdate } from '../../documents/combat/combatantSystem.js';
import { buildCombatantActionDeltaUpdate } from '../../utils/requestCombatantActionDelta.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

type TestCombatant = Combatant.Implementation & { update: ReturnType<typeof vi.fn> };

/**
 * A character combatant whose `update` writes straight back into its own system
 * data, so a test can chain the real refill/grant/fold updates in sequence and
 * read the resulting pool exactly as the next step would.
 */
function createSelfApplyingCombatant(options: {
	id?: string;
	type?: string;
	current: number;
	max: number;
	pendingDelta?: number;
}): TestCombatant {
	const combatant = createCombatantFixture({
		id: options.id ?? 'hero',
		type: options.type ?? 'character',
		actionsCurrent: options.current,
		actionsMax: options.max,
		actionsPendingDelta: options.pendingDelta ?? 0,
	}) as TestCombatant;

	combatant.update = vi.fn(async (update: Record<string, unknown>) => {
		for (const [path, value] of Object.entries(update)) {
			if (path === '_id') continue;
			foundry.utils.setProperty(combatant, path, value);
		}
		return combatant;
	});

	return combatant;
}

function applyUpdate(combatant: TestCombatant, update: Record<string, unknown> | null): void {
	if (!update) return;
	for (const [path, value] of Object.entries(update)) {
		if (path === '_id') continue;
		foundry.utils.setProperty(combatant, path, value);
	}
}

function attachToCombat(combatant: TestCombatant, activeCombatantId: string | null): Combat {
	const combat = {
		id: `combat-${combatant.id}`,
		combatant: activeCombatantId === combatant.id ? combatant : null,
		combatants: {
			get: (id: string) => (id === combatant.id ? combatant : null),
		},
	} as unknown as Combat;
	(combatant as unknown as { parent: unknown }).parent = combat;
	return combat;
}

function currentActions(combatant: TestCombatant): number {
	return Number(foundry.utils.getProperty(combatant, 'system.actions.base.current'));
}

function pendingDelta(combatant: TestCombatant): number {
	return Number(foundry.utils.getProperty(combatant, 'system.actions.pendingDelta'));
}

/** The pending grant an `actionDelta` rule with `nextTurn` timing writes. */
function grantPendingAction(combatant: TestCombatant, amount: number): void {
	applyUpdate(
		combatant,
		buildCombatantActionDeltaUpdate(combatant, { currentDelta: 0, pendingDelta: amount }),
	);
}

async function registerAndGetTurnStartHandler() {
	const callbacks = createHookCapture(globals().Hooks.on);
	const { default: registerPendingActionDeltaFold } = await import('./pendingActionDeltaFold.js');
	registerPendingActionDeltaFold();
	return callbacks.get('nimbleCombatTurnStart');
}

describe('registerPendingActionDeltaFold', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		// The fold only runs on the active GM's client, so every case below is
		// written from one. The non-GM case is asserted separately.
		globals().game.user.isGM = true;
	});

	it('registers a turn-start consumer', async () => {
		expect(await registerAndGetTurnStartHandler()).toBeDefined();
	});

	it('makes a grant written after the recipient has finished a turn spendable on their next one', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		// The hero's own turn ends first, refilling the pool for the turn to come.
		const hero = createSelfApplyingCombatant({ current: 0, max: 3 });
		attachToCombat(hero, hero.id);
		applyUpdate(hero, buildCharacterTurnRefillUpdate(hero));
		expect(currentActions(hero)).toBe(3);

		// Only then does an ally later in the round grant them an action.
		grantPendingAction(hero, 1);
		expect(pendingDelta(hero)).toBe(1);

		// Their very next turn begins, and the grant is spendable on it.
		onTurnStart?.(hero);
		await flushAsync();

		expect(currentActions(hero)).toBe(4);
		expect(pendingDelta(hero)).toBe(0);
	});

	it('writes nothing when there is no pending adjustment', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		const hero = createSelfApplyingCombatant({ current: 3, max: 3 });
		attachToCombat(hero, hero.id);

		onTurnStart?.(hero);
		await flushAsync();

		expect(hero.update).not.toHaveBeenCalled();
		expect(currentActions(hero)).toBe(3);
	});

	it('does not apply a second time when the turn-end refill already folded the grant', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		// The grant lands before the hero's turn ends, so the turn-end refill folds it.
		const hero = createSelfApplyingCombatant({ current: 0, max: 3 });
		attachToCombat(hero, hero.id);
		grantPendingAction(hero, 1);
		applyUpdate(hero, buildCharacterTurnRefillUpdate(hero));
		expect(currentActions(hero)).toBe(4);
		expect(pendingDelta(hero)).toBe(0);

		onTurnStart?.(hero);
		await flushAsync();

		expect(hero.update).not.toHaveBeenCalled();
		expect(currentActions(hero)).toBe(4);
	});

	it('keeps a heroic reaction paid between turns deducted', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		const hero = createSelfApplyingCombatant({ current: 0, max: 3 });
		attachToCombat(hero, hero.id);
		applyUpdate(hero, buildCharacterTurnRefillUpdate(hero));

		// Between turns the pool is next turn's pool, and heroic reactions are
		// spent out of it.
		applyUpdate(hero, { 'system.actions.base.current': 2 });
		grantPendingAction(hero, 1);

		onTurnStart?.(hero);
		await flushAsync();

		expect(currentActions(hero)).toBe(3);
	});

	it('clamps a pending action debt at an empty pool', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		const hero = createSelfApplyingCombatant({ current: 1, max: 3 });
		attachToCombat(hero, hero.id);
		grantPendingAction(hero, -3);

		onTurnStart?.(hero);
		await flushAsync();

		expect(currentActions(hero)).toBe(0);
		expect(pendingDelta(hero)).toBe(0);
	});

	it('leaves the adjustment pending for a passed-over combatant', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		const hero = createSelfApplyingCombatant({ current: 3, max: 3 });
		attachToCombat(hero, 'someone-else');
		grantPendingAction(hero, 1);

		onTurnStart?.(hero);
		await flushAsync();

		expect(hero.update).not.toHaveBeenCalled();
		expect(pendingDelta(hero)).toBe(1);
	});

	it('ignores non-character combatants', async () => {
		const onTurnStart = await registerAndGetTurnStartHandler();

		const monster = createSelfApplyingCombatant({
			id: 'monster',
			type: 'npc',
			current: 1,
			max: 1,
			pendingDelta: 2,
		});
		attachToCombat(monster, monster.id);

		onTurnStart?.(monster);
		await flushAsync();

		expect(monster.update).not.toHaveBeenCalled();
	});

	it('does not fold on a client that is not the active GM', async () => {
		// The turn-start hook is not GM-only: the combat document also emits it
		// from its post-advance backstop, which runs on whichever client advanced
		// the turn, and a player who owns a combatant is allowed to advance. A
		// player client must not write the fold.
		globals().game.user.isGM = false;
		const onTurnStart = await registerAndGetTurnStartHandler();

		const hero = createSelfApplyingCombatant({ current: 3, max: 3, pendingDelta: 1 });
		attachToCombat(hero, hero.id);

		onTurnStart?.(hero);
		await flushAsync();

		expect(hero.update).not.toHaveBeenCalled();
		expect(currentActions(hero)).toBe(3);
	});
});
