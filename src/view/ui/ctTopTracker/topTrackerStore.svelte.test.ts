import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
	createCombatantsCollectionFixture,
} from '../../../../tests/fixtures/combat.js';
import {
	clearExpandedTurnIdentityHint,
	setExpandedTurnIdentityHint,
} from '../../../documents/combat/expandedTurnIdentityStore.js';
import { CtTopTrackerStore } from './topTrackerStore.svelte.js';

describe('CtTopTrackerStore', () => {
	beforeEach(() => {
		clearExpandedTurnIdentityHint('combat-store-legendary-refresh');

		const globals = globalThis as unknown as {
			game: {
				user: { isGM?: boolean; role?: number };
				settings: { get: ReturnType<typeof vi.fn> };
				combats: { contents: Combat[]; viewed?: Combat | null };
				combat?: Combat | null;
			};
			canvas: typeof canvas;
		};

		globals.game.user = {
			...game.user,
			isGM: true,
			role: 4,
		};
		globals.game.settings = {
			get: vi.fn((namespace: string, key: string) => {
				if (namespace !== 'nimble') return undefined;
				switch (key) {
					case 'combatTrackerEnabled':
						return true;
					case 'combatTrackerWidthLevel':
						return 10;
					case 'combatTrackerCardSizeLevel':
						return 5;
					case 'combatTrackerResourceDrawerHoverEnabled':
						return true;
					case 'combatTrackerPlayersCanExpandMonsterCards':
						return true;
					case 'combatTrackerPlayerHpBarTextMode':
						return 'none';
					case 'combatTrackerNonPlayerHpBarEnabled':
						return false;
					case 'combatTrackerNonPlayerHpBarTextMode':
						return 'none';
					default:
						return undefined;
				}
			}),
		};
		globals.game.combats = {
			contents: [],
			viewed: null,
		};
		globals.game.combat = null;
		globals.canvas = {
			scene: {
				id: 'scene-1',
				tokens: {
					get: vi.fn(() => null),
				},
			},
		} as unknown as typeof canvas;
	});

	it('normalizes solo turns before rebuilding CT state', () => {
		const playerOne = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(playerOne as unknown as { visible: boolean }).visible = true;
		const playerTwo = createCombatantFixture({
			id: 'player-two',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(playerTwo as unknown as { visible: boolean }).visible = true;
		const solo = createCombatantFixture({
			id: 'legendary-one',
			type: 'soloMonster',
			actor: createCombatActorFixture({ type: 'soloMonster' }),
			sceneId: 'scene-1',
		});
		(solo as unknown as { visible: boolean }).visible = true;

		const rawTurns = [playerOne, playerTwo, solo] as Combatant.Implementation[];
		const expandedTurns = [playerOne, solo, playerTwo, solo] as Combatant.Implementation[];
		setExpandedTurnIdentityHint('combat-store-legendary-refresh', {
			combatantId: 'legendary-one',
			occurrence: 1,
		});

		const combatants = createCombatantsCollectionFixture([playerOne, playerTwo, solo]);
		const combat = {
			id: 'combat-store-legendary-refresh',
			active: true,
			round: 1,
			turn: 2,
			combatant: solo,
			combatants,
			turns: rawTurns,
			setupTurns: vi.fn(() => expandedTurns),
			scene: { id: 'scene-1' },
		} as unknown as Combat;

		const globals = globalThis as unknown as {
			game: {
				combats: { contents: Combat[]; viewed?: Combat | null };
				combat?: Combat | null;
			};
		};
		globals.game.combats = {
			contents: [combat],
			viewed: combat,
		};
		globals.game.combat = combat;

		const store = new CtTopTrackerStore();
		const changed = store.refreshCurrentCombat(true);

		expect(changed).toBe(true);
		expect(store.currentCombat?.turn).toBe(3);
		expect(store.sceneAliveCombatants.map((combatant) => combatant.id)).toEqual([
			'player-one',
			'legendary-one',
			'player-two',
			'legendary-one',
		]);
		expect(store.activeEntryKey).toBe('combatant-legendary-one-1');
		expect(store.orderedAliveEntries.map((entry) => entry.key)).toEqual(
			expect.arrayContaining([
				'combatant-player-one-0',
				'combatant-player-two-0',
				'combatant-legendary-one-0',
				'combatant-legendary-one-1',
			]),
		);
	});
});
