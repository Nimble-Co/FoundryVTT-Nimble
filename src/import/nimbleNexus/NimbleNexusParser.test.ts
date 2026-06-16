import { describe, expect, it } from 'vitest';
import { determineActorType } from './NimbleNexusParser.js';
import type { NimbleNexusMonsterAttributes } from './types.js';

const baseAttributes: NimbleNexusMonsterAttributes = {
	name: 'Test Monster',
	hp: 10,
	level: 1,
	size: 'medium',
	armor: 'none',
	legendary: false,
	movement: [],
	abilities: [],
	actions: [],
};

describe('determineActorType', () => {
	it('returns soloMonster for legendary creatures', () => {
		expect(determineActorType({ ...baseAttributes, legendary: true })).toBe('soloMonster');
	});

	it('returns minion when attributes.minion is true', () => {
		expect(determineActorType({ ...baseAttributes, minion: true })).toBe('minion');
	});

	it('returns npc for standard creatures', () => {
		expect(determineActorType({ ...baseAttributes })).toBe('npc');
	});

	it('legendary takes precedence over minion flag', () => {
		expect(determineActorType({ ...baseAttributes, legendary: true, minion: true })).toBe(
			'soloMonster',
		);
	});
});
