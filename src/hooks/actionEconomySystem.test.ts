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

import { collectGrantedActionOffers } from '#utils/grantedActionOffers.js';
import { handleUseItem, resolveTargetCombatants } from './actionEconomySystem.js';

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

describe('handleUseItem', () => {
	function makeItem(deltaRules: unknown[]) {
		return {
			uuid: 'Item.granting',
			isEmbedded: true,
			actor: { id: 'actor-source' },
			rules: new Map(deltaRules.map((rule, index) => [String(index), rule])),
		};
	}

	function makeDeltaRule(target: string) {
		return {
			type: 'actionDelta',
			target,
			appliesTo: () => true,
			resolveApplication: () => ({ currentDelta: 1, pendingDelta: 0 }),
		};
	}

	beforeEach(() => {
		vi.mocked(collectGrantedActionOffers).mockReturnValue([]);

		// Named, because a summary entry whose combatant has no resolvable name
		// is dropped rather than rendered pointing at nothing.
		const combatants = [
			{ ...makeCombatant({ id: 'source' }), name: 'Commander' },
			{ ...makeCombatant({ id: 'allyA' }), name: 'Sir Brannon' },
		] as unknown[];
		(globalThis as Record<string, any>).game = {
			combat: {
				started: true,
				combatants: {
					contents: combatants,
					find: (predicate: (c: unknown) => boolean) => combatants.find(predicate) ?? null,
					get: (id: string) =>
						(combatants as { id: string; name?: string }[]).find((c) => c.id === id) ?? null,
				},
			},
		};
	});

	it('writes the summary and the offers in a single card update', () => {
		// Both halves target the same document, and an item may declare action
		// adjustments and granted activations together, so two updates in one tick
		// would be two concurrent diffs on one message.
		vi.mocked(collectGrantedActionOffers).mockReturnValue([{ id: 'offer' }] as never);
		const update = vi.fn(async (_data: Record<string, unknown>) => ({}));
		const message = { system: { grantedActionOffers: [] }, update };

		handleUseItem(makeItem([makeDeltaRule('allAllies')]), message, { targets: [] });

		expect(update).toHaveBeenCalledTimes(1);
		const payload = update.mock.calls[0][0] as Record<string, unknown>;
		expect(payload['flags.nimble.actionDeltaSummary']).toBeTruthy();
		expect(payload.system).toEqual({ grantedActionOffers: [{ id: 'offer' }] });
	});

	it('writes only the offers when no rule adjusts anyone', () => {
		vi.mocked(collectGrantedActionOffers).mockReturnValue([{ id: 'offer' }] as never);
		const update = vi.fn(async (_data: Record<string, unknown>) => ({}));

		handleUseItem(makeItem([]), { system: { grantedActionOffers: [] }, update }, { targets: [] });

		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0]).toEqual({
			system: { grantedActionOffers: [{ id: 'offer' }] },
		});
	});

	it('writes only the summary on a card whose schema carries no offers', () => {
		vi.mocked(collectGrantedActionOffers).mockReturnValue([{ id: 'offer' }] as never);
		const update = vi.fn(async (_data: Record<string, unknown>) => ({}));

		handleUseItem(makeItem([makeDeltaRule('allAllies')]), { update }, { targets: [] });

		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0]).not.toHaveProperty('system');
	});

	it('leaves the card alone when there is nothing to record', () => {
		const update = vi.fn(async (_data: Record<string, unknown>) => ({}));

		handleUseItem(makeItem([]), { system: { grantedActionOffers: [] }, update }, { targets: [] });

		expect(update).not.toHaveBeenCalled();
	});
});
