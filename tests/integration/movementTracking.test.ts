/**
 * Live regression tests for the movement foundation: a token move in a started
 * combat is recorded by Foundry, summarised as Spaces Moved This Turn on the
 * actor's tags, emitted once as a movementFinished record, kept across other
 * combatants' turns, and cleared only when the mover's own turn begins.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
	createViewedTestScene,
	GRID_SIZE,
	getAutomationToggle,
	placeToken,
	purgeTestDocuments,
	setAutomationToggle,
	settle,
	waitFor,
} from './liveHelpers.ts';

const TEST_PREFIX = 'V14 Movement';
const TRACKING_SETTING = 'automation.movementTracking';

interface FinishedRecord {
	token: TokenDocument;
	kind: string;
	spaces: number;
	spacesThisTurn: number | null;
	stopped: boolean;
	path: { x: number; y: number }[];
}

interface TaggedActor extends Actor {
	tags: Set<string>;
}

function spacesTag(actor: TaggedActor): string | undefined {
	return [...actor.tags].find((tag) => tag.startsWith('spacesMovedThisTurn:'));
}

describe('movement tracking', () => {
	let scene: Scene;
	let hero: TaggedActor;
	let goblin: TaggedActor;
	let heroToken: TokenDocument;
	let goblinToken: TokenDocument;
	let combat: Combat;
	let trackingWasEnabled: boolean;
	const records: FinishedRecord[] = [];
	let hookId: number;

	beforeAll(async () => {
		await purgeTestDocuments(TEST_PREFIX);
		trackingWasEnabled = getAutomationToggle(TRACKING_SETTING);
		await setAutomationToggle(TRACKING_SETTING, true);

		hero = (await Actor.create({ name: `${TEST_PREFIX} Hero`, type: 'character' })) as TaggedActor;
		goblin = (await Actor.create({ name: `${TEST_PREFIX} Goblin`, type: 'npc' })) as TaggedActor;
		scene = await createViewedTestScene(`${TEST_PREFIX} Scene`);
		heroToken = await placeToken(scene, {
			name: hero.name,
			actor: hero,
			gx: 2,
			gy: 2,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			actorLink: true,
		});
		goblinToken = await placeToken(scene, {
			name: goblin.name,
			actor: goblin,
			gx: 8,
			gy: 2,
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
			actorLink: true,
		});

		combat = (await Combat.create({ active: true, scene: scene.id } as Combat.CreateData))!;
		await combat.createEmbeddedDocuments('Combatant', [
			{ actorId: hero.id, tokenId: heroToken.id, sceneId: scene.id, type: 'character' },
			{ actorId: goblin.id, tokenId: goblinToken.id, sceneId: scene.id, type: 'npc' },
		] as Combatant.CreateData[]);
		await combat.startCombat();
		await settle(500);

		hookId = Hooks.on(
			`${game.system.id}.movementFinished` as never,
			((record: FinishedRecord) => {
				records.push(record);
			}) as never,
		);
	}, 60_000);

	afterAll(async () => {
		Hooks.off(`${game.system.id}.movementFinished` as never, hookId);
		await combat?.delete().catch((error) => console.error(error));
		await setAutomationToggle(TRACKING_SETTING, trackingWasEnabled);
		await purgeTestDocuments(TEST_PREFIX);
	});

	test('a started combat begins with zero spaces moved on the active combatant', async () => {
		expect(combat.combatant?.actorId).toBe(hero.id);
		await waitFor(() => spacesTag(hero) === 'spacesMovedThisTurn:0', 'hero tag at zero');
	});

	test('one move records one finished movement and updates the tag', async () => {
		records.length = 0;
		await heroToken.move({ x: 5 * GRID_SIZE, y: 2 * GRID_SIZE });
		await waitFor(() => records.length > 0, 'movementFinished record');
		await settle(500);

		expect(records).toHaveLength(1);
		const [record] = records;
		expect(record.token.id).toBe(heroToken.id);
		expect(record.kind).toBe('regular');
		expect(record.spaces).toBe(3);
		expect(record.spacesThisTurn).toBe(3);
		expect(record.stopped).toBe(false);
		expect(record.path.at(-1)).toMatchObject({ x: 5 * GRID_SIZE, y: 2 * GRID_SIZE });
		await waitFor(() => spacesTag(hero) === 'spacesMovedThisTurn:3', 'hero tag at three');
	});

	test('a second move on the same turn accumulates', async () => {
		records.length = 0;
		await heroToken.move({ x: 5 * GRID_SIZE, y: 4 * GRID_SIZE });
		await waitFor(() => records.length > 0, 'second movementFinished record');
		expect(records[0].spaces).toBe(2);
		expect(records[0].spacesThisTurn).toBe(5);
		await waitFor(() => spacesTag(hero) === 'spacesMovedThisTurn:5', 'hero tag at five');
	});

	test('another combatant starting a turn keeps the mover history', async () => {
		await combat.nextTurn();
		await waitFor(() => combat.combatant?.actorId === goblin.id, 'goblin turn');
		await settle(500);
		expect(spacesTag(hero)).toBe('spacesMovedThisTurn:5');
		expect(spacesTag(goblin)).toBe('spacesMovedThisTurn:0');
	});

	test('off-turn movement counts until the mover starts a turn', async () => {
		records.length = 0;
		await heroToken.move({ x: 4 * GRID_SIZE, y: 4 * GRID_SIZE });
		await waitFor(() => records.length > 0, 'off-turn movementFinished record');
		expect(records[0].spacesThisTurn).toBe(6);
		await waitFor(() => spacesTag(hero) === 'spacesMovedThisTurn:6', 'hero tag at six');

		await combat.nextTurn();
		await waitFor(() => combat.combatant?.actorId === hero.id, 'hero turn again');
		await waitFor(() => spacesTag(hero) === 'spacesMovedThisTurn:0', 'hero tag reset');
	});

	test('the tag is absent when movement tracking is off', async () => {
		await setAutomationToggle(TRACKING_SETTING, false);
		hero.reset();
		await settle(200);
		expect(spacesTag(hero)).toBeUndefined();
		await setAutomationToggle(TRACKING_SETTING, true);
	});
});
