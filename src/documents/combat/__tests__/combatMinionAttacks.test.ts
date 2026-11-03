import { describe, expect, it } from 'vitest';
import { buildMinionAttackRollEntry } from '../combatMinionAttacks.js';

describe('buildMinionAttackRollEntry', () => {
	it('names the Held Changes the roll used, for the row on the group card', () => {
		const entry = buildMinionAttackRollEntry({
			member: { name: 'Goblin' } as never,
			memberId: 'm1',
			selectedActionId: 'a1',
			selectedAction: { name: 'Stab' },
			formula: '1d4',
			damageRoll: { isMiss: false, total: 3, toJSON: () => ({}) } as never,
			held: [{ label: 'Create an Opening', value: 1 }] as never,
			mustAttackLabel: 'Addling Arrow',
		});

		expect(entry.mustAttackLabel).toBe('Addling Arrow');
		expect(entry.primaryDieBonuses).toEqual([{ label: 'Create an Opening', value: 1 }]);
	});
});
