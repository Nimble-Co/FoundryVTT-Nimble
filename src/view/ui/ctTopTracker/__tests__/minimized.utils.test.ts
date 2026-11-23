import { describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../../../tests/fixtures/combat.js';
import {
	resolveMinimizedBarControls,
	resolveMinimizedTrackerSummary,
	shouldConfirmEndTurnEarly,
} from '../minimized.utils.js';

const VIEWED_SCENE_ID = 'scene-1';

function createCharacterCombatant(
	options: { visible?: boolean; sceneId?: string; woundsValue?: number; woundsMax?: number } = {},
) {
	const combatant = createCombatantFixture({
		id: 'grak',
		type: 'character',
		sceneId: options.sceneId ?? VIEWED_SCENE_ID,
		actor: createCombatActorFixture({
			type: 'character',
			isOwner: true,
			woundsValue: options.woundsValue,
			woundsMax: options.woundsMax,
		}),
		actionsCurrent: 2,
		actionsMax: 3,
	});
	(combatant as unknown as { visible: boolean }).visible = options.visible ?? true;
	return combatant;
}

function summarize(
	activeCombatant: Combatant.Implementation | null,
	overrides: { combatStarted?: boolean; round?: number; sceneId?: string | undefined } = {},
) {
	return resolveMinimizedTrackerSummary({
		combatStarted: overrides.combatStarted ?? true,
		round: overrides.round ?? 1,
		sceneId: 'sceneId' in overrides ? overrides.sceneId : VIEWED_SCENE_ID,
		activeCombatant,
	});
}

describe('resolveMinimizedTrackerSummary', () => {
	it('reports the round and the combatant taking its turn', () => {
		const summary = summarize(createCharacterCombatant(), { round: 3 });

		expect(summary).toMatchObject({
			combatStarted: true,
			round: 3,
			actions: { current: 2, max: 3 },
		});
		expect(summary.portraitSrc).toBeTruthy();
		expect(summary.combatantName).toBeTruthy();
	});

	it('reports no active combatant before combat starts', () => {
		const summary = summarize(createCharacterCombatant(), { combatStarted: false, round: 1 });

		expect(summary).toMatchObject({
			combatStarted: false,
			round: 1,
			combatantName: null,
			portraitSrc: null,
			actions: null,
		});
	});

	it('reports no active combatant when the combat has none', () => {
		const summary = summarize(null, { round: 2 });

		expect(summary).toMatchObject({
			combatantName: null,
			portraitSrc: null,
			actions: null,
		});
	});

	it('hides a combatant while visible is false and shows them once it is true', () => {
		const combatant = createCharacterCombatant();
		let viewerIsGm = false;
		Object.defineProperty(combatant, 'visible', { get: () => viewerIsGm });

		expect(summarize(combatant).combatantName).toBeNull();

		viewerIsGm = true;

		expect(summarize(combatant).combatantName).toBeTruthy();
	});

	it('reports no active combatant when the active one is defeated', () => {
		const combatant = createCombatantFixture({
			type: 'npc',
			defeated: true,
			actor: createCombatActorFixture({ type: 'npc', hp: 12 }),
		});
		(combatant as unknown as { visible: boolean }).visible = true;

		expect(summarize(combatant)).toMatchObject({
			combatantName: null,
			portraitSrc: null,
			actions: null,
		});
	});

	it('reports no active combatant when a character is out of wounds', () => {
		const summary = summarize(createCharacterCombatant({ woundsValue: 3, woundsMax: 3 }));

		expect(summary.combatantName).toBeNull();
		expect(summary.actions).toBeNull();
	});

	it('reports no active combatant when they are on another scene', () => {
		const summary = summarize(createCharacterCombatant({ sceneId: 'scene-2' }));

		expect(summary.combatantName).toBeNull();
		expect(summary.actions).toBeNull();
	});

	it('reports no active combatant when the viewed scene is unknown', () => {
		const summary = summarize(createCharacterCombatant(), { sceneId: undefined });

		expect(summary.combatantName).toBeNull();
	});

	it('floors fractional action counts so the strip never shows a partial action', () => {
		const combatant = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
			actionsCurrent: 1.7,
			actionsMax: 3.2,
		});
		(combatant as unknown as { visible: boolean }).visible = true;

		expect(summarize(combatant).actions).toEqual({ current: 1, max: 3 });
	});
});

describe('resolveMinimizedBarControls', () => {
	it('gives the GM the turn arrows and Start Combat before combat starts', () => {
		expect(
			resolveMinimizedBarControls({
				isGM: true,
				isOwner: false,
				combatStarted: false,
				combatantShown: false,
			}),
		).toEqual({
			showTurnArrows: true,
			showStartCombat: true,
			showEndTurn: false,
		});
	});

	it('gives the GM End Turn once a combatant is on the bar', () => {
		expect(
			resolveMinimizedBarControls({
				isGM: true,
				isOwner: false,
				combatStarted: true,
				combatantShown: true,
			}),
		).toEqual({
			showTurnArrows: true,
			showStartCombat: false,
			showEndTurn: true,
		});
	});

	it('gives the owner End Turn and hides the GM controls', () => {
		expect(
			resolveMinimizedBarControls({
				isGM: false,
				isOwner: true,
				combatStarted: true,
				combatantShown: true,
			}),
		).toEqual({
			showTurnArrows: false,
			showStartCombat: false,
			showEndTurn: true,
		});
	});

	it('hides every turn control from a player who does not own the combatant', () => {
		expect(
			resolveMinimizedBarControls({
				isGM: false,
				isOwner: false,
				combatStarted: true,
				combatantShown: true,
			}),
		).toEqual({
			showTurnArrows: false,
			showStartCombat: false,
			showEndTurn: false,
		});
	});

	it('hides End Turn when the bar is not showing the combatant', () => {
		expect(
			resolveMinimizedBarControls({
				isGM: true,
				isOwner: true,
				combatStarted: true,
				combatantShown: false,
			}).showEndTurn,
		).toBe(false);
	});
});

describe('shouldConfirmEndTurnEarly', () => {
	it('asks a player to confirm while they still have actions', () => {
		expect(
			shouldConfirmEndTurnEarly({
				allActionsUsed: false,
				combatant: createCharacterCombatant(),
			}),
		).toBe(true);
	});

	it('does not ask once every action is spent', () => {
		expect(
			shouldConfirmEndTurnEarly({
				allActionsUsed: true,
				combatant: createCharacterCombatant(),
			}),
		).toBe(false);
	});

	it('does not ask for a monster', () => {
		const combatant = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
		});

		expect(shouldConfirmEndTurnEarly({ allActionsUsed: false, combatant })).toBe(false);
	});
});
