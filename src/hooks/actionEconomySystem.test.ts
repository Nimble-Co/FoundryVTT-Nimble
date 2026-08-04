import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#system', () => ({
	SYSTEM_ID: 'nimble',
	systemHookName: (name: string) => `nimble.${name}`,
}));
vi.mock('#utils/grantedActionOffers.js', () => ({ collectGrantedActionOffers: vi.fn(() => []) }));
vi.mock('#utils/requestCombatantActionDelta.js', () => ({
	requestCombatantActionDelta: vi.fn(),
}));
vi.mock('#utils/isCombatantDead.js', () => ({
	isCombatantDead: (combatant: { dead?: boolean }) => Boolean(combatant?.dead),
}));

import { resolveTargetCombatants } from './actionEconomySystem.js';

const FRIENDLY = 1;
const HOSTILE = -1;

function makeCombatant({
	id,
	type = 'character',
	disposition = FRIENDLY,
	dead = false,
	actorId = `actor-${id}`,
}: {
	id: string;
	type?: string;
	disposition?: number;
	dead?: boolean;
	actorId?: string;
}) {
	return { id, type, dead, actorId, token: { disposition } };
}

function resolve(target: string, combatants: ReturnType<typeof makeCombatant>[], sourceId: string) {
	const combat = { combatants: { contents: combatants } };
	const source = combatants.find((c) => c.id === sourceId) ?? null;
	return resolveTargetCombatants({
		combat: combat as never,
		rule: { target } as never,
		sourceCombatant: source as never,
		targets: [],
	}).map((c) => c.id);
}

describe('resolveTargetCombatants', () => {
	let roster: ReturnType<typeof makeCombatant>[];

	beforeEach(() => {
		roster = [
			makeCombatant({ id: 'source' }),
			makeCombatant({ id: 'allyA' }),
			makeCombatant({ id: 'allyB' }),
			makeCombatant({ id: 'enemy', disposition: HOSTILE }),
			makeCombatant({ id: 'npc', type: 'npc' }),
		];
	});

	describe('allAllies', () => {
		it('excludes the source combatant', () => {
			// An ally is a friendly creature other than yourself, so a feature that
			// benefits every ally must not also benefit whoever used it.
			expect(resolve('allAllies', roster, 'source')).toEqual(['allyA', 'allyB']);
		});

		it('excludes combatants of a different disposition', () => {
			expect(resolve('allAllies', roster, 'source')).not.toContain('enemy');
		});

		it('excludes non-character combatants sharing the disposition', () => {
			expect(resolve('allAllies', roster, 'source')).not.toContain('npc');
		});

		it('excludes dead allies', () => {
			roster[1].dead = true;
			expect(resolve('allAllies', roster, 'source')).toEqual(['allyB']);
		});

		it('returns nothing when the source is the only ally', () => {
			const solo = [roster[0], roster[3]];
			expect(resolve('allAllies', solo, 'source')).toEqual([]);
		});
	});

	describe('self', () => {
		it('still resolves to the source, so a rule can cover both', () => {
			expect(resolve('self', roster, 'source')).toEqual(['source']);
		});
	});
});
