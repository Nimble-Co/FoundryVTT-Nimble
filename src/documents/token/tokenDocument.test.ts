import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
import { NimbleTokenDocument } from './tokenDocument.js';

function tokenWithActorType(type: string | null | undefined): TokenDocument {
	return {
		actor: type ? ({ type } as Actor.Implementation) : undefined,
	} as TokenDocument;
}

describe('NimbleTokenDocument.getCombatantType', () => {
	it('returns npc for minion actors because combatant schema does not allow minion type', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('minion'))).toBe('npc');
	});

	it('returns character for character actors', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('character'))).toBe('character');
	});

	it('returns soloMonster for solo monster actors', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('soloMonster'))).toBe(
			'soloMonster',
		);
	});

	it('returns npc by default', () => {
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType('npc'))).toBe('npc');
		expect(NimbleTokenDocument.getCombatantType(tokenWithActorType(undefined))).toBe('npc');
	});
});

describe('NimbleTokenDocument._shouldRecordMovementHistory', () => {
	type Globals = { game: { combats?: unknown; settings?: unknown } };
	const globals = globalThis as unknown as Globals;
	const base = Object.getPrototypeOf(NimbleTokenDocument.prototype) as {
		_shouldRecordMovementHistory?: () => boolean;
	};
	const original = { combats: globals.game.combats, settings: globals.game.settings };
	const coreRecords = vi.fn(() => false);

	function setMovementTracking(enabled: boolean) {
		globals.game.settings = {
			get: (_namespace: string, key: string) =>
				key === AUTOMATION_SETTING_KEYS.movementTracking ? enabled : undefined,
		};
	}

	function combatHolding(tokenId: string, sceneId: string, started = true) {
		return { started, combatants: [{ tokenId, sceneId }] };
	}

	function shouldRecord(): boolean {
		const token = new NimbleTokenDocument({
			id: 't1',
			parent: { id: 's1' },
		} as never) as unknown as {
			_shouldRecordMovementHistory(): boolean;
		};
		return token._shouldRecordMovementHistory();
	}

	beforeEach(() => {
		base._shouldRecordMovementHistory = coreRecords;
	});

	afterEach(() => {
		delete base._shouldRecordMovementHistory;
		globals.game.combats = original.combats;
		globals.game.settings = original.settings;
	});

	it('records in a started combat the client is not viewing', () => {
		setMovementTracking(true);
		globals.game.combats = [combatHolding('other', 's1'), combatHolding('t1', 's1')];
		expect(shouldRecord()).toBe(true);
		expect(coreRecords).not.toHaveBeenCalled();
	});

	it('does not record when no started combat holds the token on its scene', () => {
		setMovementTracking(true);
		globals.game.combats = [combatHolding('t1', 's1', false), combatHolding('t1', 's2')];
		expect(shouldRecord()).toBe(false);
	});

	it('leaves the decision to core while Movement Tracking is off', () => {
		setMovementTracking(false);
		globals.game.combats = [combatHolding('t1', 's1')];
		expect(shouldRecord()).toBe(false);
		expect(coreRecords).toHaveBeenCalledOnce();
	});
});
