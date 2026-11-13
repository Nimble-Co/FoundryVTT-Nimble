import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEnemyAttacker } from '../isEnemyAttacker.ts';

const FRIENDLY = 1;
const NEUTRAL = 0;
const HOSTILE = -1;

function creature(type: string, disposition?: number) {
	return {
		type,
		token: null,
		getActiveTokens: () => (disposition === undefined ? [] : [{ disposition }]),
	};
}

describe('isEnemyAttacker', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is an enemy when the two tokens have different dispositions', () => {
		expect(isEnemyAttacker(creature('npc', HOSTILE), creature('character', FRIENDLY))).toBe(true);
		expect(isEnemyAttacker(creature('npc', NEUTRAL), creature('character', FRIENDLY))).toBe(true);
	});

	it('is not an enemy when the dispositions are the same, whatever the kind of creature', () => {
		expect(isEnemyAttacker(creature('character', FRIENDLY), creature('character', FRIENDLY))).toBe(
			false,
		);
		expect(isEnemyAttacker(creature('npc', FRIENDLY), creature('character', FRIENDLY))).toBe(false);
	});

	it('reads the token of an unlinked actor first', () => {
		const attacker = { ...creature('npc', FRIENDLY), token: { disposition: HOSTILE } };

		expect(isEnemyAttacker(attacker, creature('character', FRIENDLY))).toBe(true);
	});

	it('reads the token that spoke the attack card first', () => {
		const speakerToken = { disposition: FRIENDLY };
		vi.stubGlobal('game', {
			...game,
			scenes: {
				get: (id: string) =>
					id === 'scene'
						? { tokens: { get: (token: string) => (token === 't' ? speakerToken : undefined) } }
						: undefined,
			},
		});
		const card = { speaker: { scene: 'scene', token: 't' } };

		expect(isEnemyAttacker(creature('npc', HOSTILE), creature('character', FRIENDLY), card)).toBe(
			false,
		);
	});

	it('with no disposition, a character and a non-character are enemies', () => {
		expect(isEnemyAttacker(creature('npc'), creature('character'))).toBe(true);
		expect(isEnemyAttacker(creature('character'), creature('character'))).toBe(false);
		expect(isEnemyAttacker(creature('npc'), creature('soloMonster'))).toBe(false);
		expect(isEnemyAttacker(creature('npc', HOSTILE), creature('character'))).toBe(true);
	});

	it('is never an enemy of itself, or with a creature missing', () => {
		const self = creature('npc', HOSTILE);

		expect(isEnemyAttacker(self, self)).toBe(false);
		expect(isEnemyAttacker(null, self)).toBe(false);
		expect(isEnemyAttacker(self, undefined)).toBe(false);
	});
});
