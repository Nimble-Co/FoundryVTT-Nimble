import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCombatActorFixture, createCombatantFixture } from '../../tests/fixtures/combat.js';
import { clearExpandedTurnIdentityHint } from '../documents/combat/expandedTurnIdentityStore.js';
import { syncCombatTurns } from './combatTurnSync.js';

describe('syncCombatTurns', () => {
	beforeEach(() => {
		clearExpandedTurnIdentityHint('combat-turn-sync-active-combatant');
	});

	it('syncs combat.combatant to the normalized active turn identity', () => {
		const playerOne = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const playerTwo = createCombatantFixture({
			id: 'player-two',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const solo = createCombatantFixture({
			id: 'legendary-one',
			type: 'soloMonster',
			actor: createCombatActorFixture({ type: 'soloMonster' }),
		});

		const expandedTurns = [playerOne, solo, playerTwo, solo] as Combatant.Implementation[];
		const rawTurns = [playerOne, playerTwo, solo] as Combatant.Implementation[];
		const combat = {
			id: 'combat-turn-sync-active-combatant',
			flags: {
				nimble: {
					expandedTurnIdentity: {
						combatantId: 'player-two',
						occurrence: 0,
					},
				},
			},
			turns: rawTurns,
			turn: 0,
			setupTurns: vi.fn(() => expandedTurns),
		} as unknown as Combat & {
			_nimbleExpandedTurnIdentity?: { combatantId: string; occurrence: number | null } | null;
		};
		Object.defineProperty(combat, 'combatant', {
			configurable: true,
			get() {
				const turnIndex =
					typeof combat.turn === 'number' && combat.turn >= 0 && combat.turn < combat.turns.length
						? combat.turn
						: 0;
				return combat.turns[turnIndex] ?? null;
			},
		});

		syncCombatTurns(combat);

		expect(combat.turn).toBe(2);
		expect(combat.combatant?.id).toBe('player-two');
		expect(combat._nimbleExpandedTurnIdentity).toEqual({
			combatantId: 'player-two',
			occurrence: 0,
		});
	});
});
