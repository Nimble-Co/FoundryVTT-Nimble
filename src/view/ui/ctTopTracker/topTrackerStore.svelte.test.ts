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

	function createMonsterExpansionCombat(expanded: boolean, playersCanViewExpanded = false): Combat {
		const player = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(player as unknown as { visible: boolean }).visible = true;
		const monster = createCombatantFixture({
			id: 'monster-one',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
			sceneId: 'scene-1',
		});
		(monster as unknown as { visible: boolean }).visible = true;
		const turns = [player, monster] as Combatant.Implementation[];
		return {
			id: 'combat-store-monster-expansion',
			active: true,
			round: 1,
			turn: 0,
			combatant: player,
			combatants: createCombatantsCollectionFixture([player, monster]),
			turns,
			setupTurns: vi.fn(() => turns),
			scene: { id: 'scene-1' },
			flags: {
				nimble: {
					ctMonsterCardsExpanded: expanded,
					ctPlayersCanViewExpandedMonsters: playersCanViewExpanded,
				},
			},
			update: vi.fn().mockResolvedValue(undefined),
		} as unknown as Combat;
	}

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

	it('mirrors shared monster expansion to players only when the current combat allows it', () => {
		const globals = globalThis as unknown as {
			game: {
				user: { isGM?: boolean; role?: number };
				settings: { get: ReturnType<typeof vi.fn> };
				combats: { contents: Combat[]; viewed?: Combat | null };
				combat?: Combat | null;
			};
		};
		globals.game.user = {
			...game.user,
			isGM: false,
			role: 1,
		};
		const combat = createMonsterExpansionCombat(true, false);
		globals.game.combats = {
			contents: [combat],
			viewed: combat,
		};
		globals.game.combat = combat;

		const store = new CtTopTrackerStore();
		store.refreshCurrentCombat(true);

		expect(store.canCurrentUserToggleMonsterCards).toBe(false);
		expect(store.monsterCardsExpanded).toBe(false);
		expect(store.aliveEntries.some((entry) => entry.kind === 'monster-stack')).toBe(true);

		(
			combat.flags as { nimble: { ctPlayersCanViewExpandedMonsters: boolean } }
		).nimble.ctPlayersCanViewExpandedMonsters = true;
		store.refreshCurrentCombat(true);

		expect(store.monsterCardsExpanded).toBe(true);
		expect(store.aliveEntries.map((entry) => entry.key)).toContain('combatant-monster-one-0');
	});

	it('builds separate collapsed stacks for each contiguous monster run', () => {
		const playerOne = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(playerOne as unknown as { visible: boolean }).visible = true;
		const monsterOne = createCombatantFixture({
			id: 'monster-one',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
			sceneId: 'scene-1',
		});
		(monsterOne as unknown as { visible: boolean }).visible = true;
		const monsterTwo = createCombatantFixture({
			id: 'monster-two',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
			sceneId: 'scene-1',
		});
		(monsterTwo as unknown as { visible: boolean }).visible = true;
		const playerTwo = createCombatantFixture({
			id: 'player-two',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(playerTwo as unknown as { visible: boolean }).visible = true;
		const monsterThree = createCombatantFixture({
			id: 'monster-three',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
			sceneId: 'scene-1',
		});
		(monsterThree as unknown as { visible: boolean }).visible = true;

		const turns = [
			playerOne,
			monsterOne,
			monsterTwo,
			playerTwo,
			monsterThree,
		] as Combatant.Implementation[];
		const combat = {
			id: 'combat-store-multi-stack',
			active: true,
			round: 1,
			turn: 0,
			combatant: playerOne,
			combatants: createCombatantsCollectionFixture([
				playerOne,
				monsterOne,
				monsterTwo,
				playerTwo,
				monsterThree,
			]),
			turns,
			setupTurns: vi.fn(() => turns),
			scene: { id: 'scene-1' },
			flags: {
				nimble: {
					ctMonsterCardsExpanded: false,
					ctPlayersCanViewExpandedMonsters: false,
				},
			},
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
		store.refreshCurrentCombat(true);

		expect(store.aliveEntries.map((entry) => entry.kind)).toEqual([
			'combatant',
			'monster-stack',
			'combatant',
			'monster-stack',
		]);
		expect(
			store.aliveEntries
				.filter(
					(
						entry,
					): entry is Extract<(typeof store.aliveEntries)[number], { kind: 'monster-stack' }> =>
						entry.kind === 'monster-stack',
				)
				.map((entry) => entry.combatants.length),
		).toEqual([2, 1]);
	});

	it('does not mark an active entry before combat starts', () => {
		const player = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(player as unknown as { visible: boolean }).visible = true;
		const monster = createCombatantFixture({
			id: 'monster-one',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
			sceneId: 'scene-1',
		});
		(monster as unknown as { visible: boolean }).visible = true;

		const turns = [player, monster] as Combatant.Implementation[];
		const combat = {
			id: 'combat-store-prestart',
			active: true,
			started: false,
			round: 0,
			turn: 0,
			combatant: player,
			combatants: createCombatantsCollectionFixture([player, monster]),
			turns,
			setupTurns: vi.fn(() => turns),
			scene: { id: 'scene-1' },
			flags: {
				nimble: {
					ctMonsterCardsExpanded: true,
					ctPlayersCanViewExpandedMonsters: true,
				},
			},
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
		store.refreshCurrentCombat(true);

		expect(store.combatStarted).toBe(false);
		expect(store.activeEntryKey).toBeNull();
		expect(store.orderedAliveEntries.map((entry) => entry.key)).toEqual([
			'combatant-player-one-0',
			'combatant-monster-one-0',
		]);
	});

	it('does not expose grouped minion members as separate expanded monster turns', () => {
		const player = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			sceneId: 'scene-1',
		});
		(player as unknown as { visible: boolean }).visible = true;
		const minionLeader = createCombatantFixture({
			id: 'minion-leader',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'minion' }),
			sceneId: 'scene-1',
			flags: {
				nimble: { minionGroup: { id: 'group-1', role: 'leader' } },
			},
		});
		(minionLeader as unknown as { visible: boolean }).visible = true;
		const minionMember = createCombatantFixture({
			id: 'minion-member',
			type: 'npc',
			actor: createCombatActorFixture({ type: 'minion' }),
			sceneId: 'scene-1',
			flags: {
				nimble: { minionGroup: { id: 'group-1', role: 'member' } },
			},
		});
		(minionMember as unknown as { visible: boolean }).visible = true;

		const turns = [player, minionLeader] as Combatant.Implementation[];
		const combat = {
			id: 'combat-store-expanded-minion-group',
			active: true,
			round: 1,
			turn: 0,
			combatant: player,
			combatants: createCombatantsCollectionFixture([player, minionLeader, minionMember]),
			turns,
			setupTurns: vi.fn(() => turns),
			scene: { id: 'scene-1' },
			flags: {
				nimble: {
					ctMonsterCardsExpanded: true,
					ctPlayersCanViewExpandedMonsters: true,
				},
			},
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
		store.refreshCurrentCombat(true);

		expect(store.monsterCardsExpanded).toBe(true);
		expect(store.sceneAliveCombatants.map((combatant) => combatant.id)).toEqual([
			'player-one',
			'minion-leader',
		]);
		expect(store.aliveEntries.map((entry) => entry.key)).toEqual([
			'combatant-player-one-0',
			'combatant-minion-leader-0',
		]);
	});

	it('updates the shared monster expansion flag when the GM toggles expansion', async () => {
		const globals = globalThis as unknown as {
			game: {
				combats: { contents: Combat[]; viewed?: Combat | null };
				combat?: Combat | null;
			};
		};
		const combat = createMonsterExpansionCombat(false) as Combat & {
			update: ReturnType<typeof vi.fn>;
		};
		globals.game.combats = {
			contents: [combat],
			viewed: combat,
		};
		globals.game.combat = combat;

		const store = new CtTopTrackerStore();
		store.refreshCurrentCombat(true);

		await expect(store.toggleMonsterCardsExpanded()).resolves.toBe(true);
		expect(combat.update).toHaveBeenCalledWith({
			'flags.nimble.ctMonsterCardsExpanded': true,
		});
	});
});
