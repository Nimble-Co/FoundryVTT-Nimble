import { describe, expect, it } from 'vitest';
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
