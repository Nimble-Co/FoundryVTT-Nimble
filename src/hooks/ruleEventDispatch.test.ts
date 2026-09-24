import type { Mock } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Track the hook event handlers registered during module import.
const handlers = new Map<string, (...args: unknown[]) => void>();
const hooksOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
	handlers.set(event, handler);
	return 1;
});

vi.stubGlobal('Hooks', {
	on: hooksOn,
	once: vi.fn(),
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn(),
});

const settingsGet = vi.fn().mockReturnValue(false);
vi.stubGlobal('game', {
	settings: { get: settingsGet },
});

vi.stubGlobal('foundry', {
	utils: {
		hasProperty: (target: unknown, path: string) => {
			const segments = path.split('.');
			let cursor: unknown = target;
			for (const segment of segments) {
				if (cursor === null || typeof cursor !== 'object') return false;
				if (!(segment in (cursor as Record<string, unknown>))) return false;
				cursor = (cursor as Record<string, unknown>)[segment];
			}
			return true;
		},
	},
});

vi.mock('../utils/actorHealthState.js', () => ({
	getActorHealthState: vi.fn(() => 'normal'),
}));

import { getActorHealthState } from '../utils/actorHealthState.js';
import registerRuleEventDispatch from './ruleEventDispatch.js';

interface RuleLike {
	onItemUsed: Mock;
	onAttackReceived: Mock;
	onTurnStart: Mock;
	onTurnEnd: Mock;
	onActorKilled: Mock;
	onActorWounded: Mock;
	onSaveResolved: Mock;
	onRest: Mock;
	onInitiativeRolled: Mock;
	onItemActivated: Mock;
	onEncounterEnd: Mock;
	onActorDying: Mock;
	onRoundChanged: Mock;
	onMovementFinished: Mock;
	onPoolGain: Mock;
	onActiveGmTurnStart: Mock;
}

function createMockRule(): RuleLike {
	return {
		onItemUsed: vi.fn().mockResolvedValue(undefined),
		onAttackReceived: vi.fn().mockResolvedValue(undefined),
		onTurnStart: vi.fn().mockResolvedValue(undefined),
		onTurnEnd: vi.fn().mockResolvedValue(undefined),
		onActorKilled: vi.fn().mockResolvedValue(undefined),
		onActorWounded: vi.fn().mockResolvedValue(undefined),
		onSaveResolved: vi.fn().mockResolvedValue(undefined),
		onRest: vi.fn().mockResolvedValue(undefined),
		onInitiativeRolled: vi.fn().mockResolvedValue(undefined),
		onItemActivated: vi.fn().mockResolvedValue(undefined),
		onEncounterEnd: vi.fn().mockResolvedValue(undefined),
		onActorDying: vi.fn().mockResolvedValue(undefined),
		onRoundChanged: vi.fn().mockResolvedValue(undefined),
		onMovementFinished: vi.fn().mockResolvedValue(undefined),
		onPoolGain: vi.fn().mockResolvedValue(undefined),
		onActiveGmTurnStart: vi.fn().mockResolvedValue(undefined),
	};
}

describe('ruleEventDispatch', () => {
	beforeAll(() => {
		// Register once — the dispatcher has an internal idempotency latch.
		registerRuleEventDispatch();
	});

	beforeEach(() => {
		settingsGet.mockReset();
		settingsGet.mockReturnValue(true);
		(getActorHealthState as unknown as Mock).mockReset();
		(getActorHealthState as unknown as Mock).mockReturnValue('normal');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('registers the expected hook event names', () => {
		expect(handlers.has('nimble.damageApplied')).toBe(true);
		expect(handlers.has('combatTurn')).toBe(true);
		expect(handlers.has('updateActor')).toBe(true);
		expect(handlers.has('nimble.saveResolved')).toBe(true);
		expect(handlers.has('nimble.rest')).toBe(true);
		expect(handlers.has('nimble.initiativeRolled')).toBe(true);
		expect(handlers.has('nimble.useItem')).toBe(true);
		expect(handlers.has('updateCombat')).toBe(true);
		expect(handlers.has('deleteCombat')).toBe(true);
		expect(handlers.has('nimble.conditionApplied')).toBe(true);
		expect(handlers.has('nimble.movementFinished')).toBe(true);
		expect(handlers.has('nimble.dicePool.changed')).toBe(true);
		expect(handlers.has('nimbleCombatTurnStart')).toBe(true);
	});

	describe('automation.applyRuleEffects gating', () => {
		// A rule class that declares an always-dispatched lifecycle event, the
		// way core-plumbing rule classes exempt themselves from the toggle.
		class AlwaysActivatedRule {
			static alwaysDispatchedEvents: readonly string[] = ['onItemActivated'];

			onItemActivated = vi.fn().mockResolvedValue(undefined);

			onTurnStart = vi.fn().mockResolvedValue(undefined);
		}

		it('skips dispatch when setting is disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = createMockRule();
			const sourceActor = { rules: [rule] };
			const targetActor = { rules: [] };

			const handler = handlers.get('nimble.damageApplied');
			expect(handler).toBeDefined();
			handler?.({
				sourceItem: {},
				sourceActor,
				targetActor,
				card: null,
				isCritical: true,
				isMiss: false,
			});

			await Promise.resolve();
			expect(rule.onItemUsed).not.toHaveBeenCalled();
		});

		it('still dispatches always-dispatched events to exempt rule classes when disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = new AlwaysActivatedRule();
			const sourceActor = { rules: [rule] };
			const sourceItem = { actor: sourceActor, name: 'Focus' };

			handlers.get('nimble.useItem')?.(sourceItem, null, { rolls: [], targets: [] });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onItemActivated).toHaveBeenCalledTimes(1);
		});

		it('does not dispatch non-exempt events to exempt rule classes when disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = new AlwaysActivatedRule();
			const nextCombatant = { actor: { rules: [rule] } } as unknown as Combatant;
			const combat = {
				combatant: null,
				turns: [nextCombatant],
			} as unknown as Combat;

			handlers.get('combatTurn')?.(combat, { round: 1, turn: 0 }, { direction: 1 });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onTurnStart).not.toHaveBeenCalled();
		});
	});

	describe('nimble.damageApplied → onItemUsed', () => {
		it('calls onItemUsed on each rule of the source actor with the target', async () => {
			const rule = createMockRule();
			const sourceActor = { rules: [rule] };
			const targetActor = { rules: [] };

			const handler = handlers.get('nimble.damageApplied');
			handler?.({
				sourceItem: { name: 'Shadow Blast' },
				sourceActor,
				targetActor,
				card: null,
				isCritical: true,
				isMiss: false,
			});
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onItemUsed).toHaveBeenCalledTimes(1);
			const ctx = rule.onItemUsed.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({
				isCritical: true,
				isMiss: false,
				sourceActor,
				targetActor,
			});
		});

		it('calls onAttackReceived on each rule of the target actor', async () => {
			const sourceRule = createMockRule();
			const targetRule = createMockRule();
			const sourceActor = { rules: [sourceRule] };
			const targetActor = { rules: [targetRule] };

			const handler = handlers.get('nimble.damageApplied');
			handler?.({
				sourceItem: { name: 'Shadow Blast' },
				sourceActor,
				targetActor,
				card: null,
				isCritical: true,
				isMiss: false,
			});
			await Promise.resolve();
			await Promise.resolve();

			expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
			expect(targetRule.onItemUsed).not.toHaveBeenCalled();
			expect(sourceRule.onAttackReceived).not.toHaveBeenCalled();
			const ctx = targetRule.onAttackReceived.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({ isCritical: true, sourceActor, targetActor });
		});

		it('no-ops when sourceActor or targetActor is missing', async () => {
			const handler = handlers.get('nimble.damageApplied');
			expect(() =>
				handler?.({
					sourceItem: {},
					sourceActor: null,
					targetActor: null,
					card: null,
					isCritical: true,
					isMiss: false,
				}),
			).not.toThrow();
			await Promise.resolve();
		});
	});

	describe('combatTurn → onTurnStart/onTurnEnd', () => {
		it('fires onTurnEnd on the previous combatant and onTurnStart on the next', async () => {
			const previousRule = createMockRule();
			const nextRule = createMockRule();
			const previousActor = { rules: [previousRule] };
			const nextActor = { rules: [nextRule] };
			const previousCombatant = { actor: previousActor } as unknown as Combatant;
			const nextCombatant = { actor: nextActor } as unknown as Combatant;
			const combat = {
				combatant: previousCombatant,
				turns: [nextCombatant],
			} as unknown as Combat;

			const handler = handlers.get('combatTurn');
			handler?.(combat, { round: 1, turn: 0 }, { advanceTime: 0, direction: 1 });
			await Promise.resolve();
			await Promise.resolve();

			expect(previousRule.onTurnEnd).toHaveBeenCalledTimes(1);
			expect(nextRule.onTurnStart).toHaveBeenCalledTimes(1);
		});

		it('registers combatRound so round wraps dispatch turn events too', async () => {
			// A wrap fires only combatRound in Foundry (nextTurn delegates to
			// nextRound), so the last combatant's onTurnEnd arrives via this
			// registration.
			const previousRule = createMockRule();
			const nextRule = createMockRule();
			const previousCombatant = { actor: { rules: [previousRule] } } as unknown as Combatant;
			const nextCombatant = { actor: { rules: [nextRule] } } as unknown as Combatant;
			const combat = {
				combatant: previousCombatant,
				turns: [nextCombatant, previousCombatant],
			} as unknown as Combat;

			const handler = handlers.get('combatRound');
			expect(handler).toBeDefined();
			handler?.(combat, { round: 2, turn: 0 }, { direction: 1 });
			await Promise.resolve();
			await Promise.resolve();

			expect(previousRule.onTurnEnd).toHaveBeenCalledTimes(1);
			expect(nextRule.onTurnStart).toHaveBeenCalledTimes(1);
		});

		it('dispatches no turn events for backwards navigation (rewind)', async () => {
			const previousRule = createMockRule();
			const nextRule = createMockRule();
			const previousCombatant = { actor: { rules: [previousRule] } } as unknown as Combatant;
			const nextCombatant = { actor: { rules: [nextRule] } } as unknown as Combatant;
			const combat = {
				combatant: previousCombatant,
				turns: [nextCombatant, previousCombatant],
			} as unknown as Combat;

			handlers.get('combatTurn')?.(combat, { round: 2, turn: 0 }, { direction: -1 });
			handlers.get('combatRound')?.(combat, { round: 1, turn: 1 }, { direction: -1 });
			await Promise.resolve();
			await Promise.resolve();

			expect(previousRule.onTurnEnd).not.toHaveBeenCalled();
			expect(nextRule.onTurnStart).not.toHaveBeenCalled();
		});

		it('handles a null next turn on round wraps without dispatching onTurnStart', async () => {
			const previousRule = createMockRule();
			const previousCombatant = { actor: { rules: [previousRule] } } as unknown as Combatant;
			const combat = {
				combatant: previousCombatant,
				turns: [previousCombatant],
			} as unknown as Combat;

			handlers.get('combatRound')?.(combat, { round: 2, turn: null }, { direction: 1 });
			await Promise.resolve();
			await Promise.resolve();

			expect(previousRule.onTurnEnd).toHaveBeenCalledTimes(1);
			expect(previousRule.onTurnStart).not.toHaveBeenCalled();
		});
	});

	describe('updateActor → onActorKilled/onActorWounded', () => {
		it('fires onActorKilled at 0 HP for actors without a wound track (monsters)', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: { attributes: { hp: { value: 0, max: 20 } } },
			};
			const changes = { system: { attributes: { hp: { value: 0 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorKilled).toHaveBeenCalledTimes(1);
			expect(rule.onActorDying).not.toHaveBeenCalled();
			expect(rule.onActorWounded).not.toHaveBeenCalled();
		});

		it('fires onActorDying at 0 HP when the wound track is not full (dying PC)', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: {
					attributes: { hp: { value: 0, max: 20 }, wounds: { value: 2, max: 6 } },
				},
			};
			const changes = { system: { attributes: { hp: { value: 0 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorDying).toHaveBeenCalledTimes(1);
			expect(rule.onActorKilled).not.toHaveBeenCalled();
		});

		it('fires onActorKilled at 0 HP when the wound track is full (dead PC)', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: {
					attributes: { hp: { value: 0, max: 20 }, wounds: { value: 6, max: 6 } },
				},
			};
			const changes = { system: { attributes: { hp: { value: 0 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorKilled).toHaveBeenCalledTimes(1);
			expect(rule.onActorDying).not.toHaveBeenCalled();
		});

		it('fires onActorWounded when HP changed and state is bloodied', async () => {
			(getActorHealthState as unknown as Mock).mockReturnValue('bloodied');
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: { attributes: { hp: { value: 5, max: 20 } } },
			};
			const changes = { system: { attributes: { hp: { value: 5 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorWounded).toHaveBeenCalledTimes(1);
			expect(rule.onActorKilled).not.toHaveBeenCalled();
		});

		it('fires onActorKilled when the final wound lands via a wounds-only update at 0 HP', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: {
					attributes: { hp: { value: 0, max: 20 }, wounds: { value: 6, max: 6 } },
				},
			};
			const changes = { system: { attributes: { wounds: { value: 6 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorKilled).toHaveBeenCalledTimes(1);
			expect(rule.onActorDying).not.toHaveBeenCalled();
		});

		it('does not re-fire onActorDying for a wounds-only update below max at 0 HP', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: {
					attributes: { hp: { value: 0, max: 20 }, wounds: { value: 3, max: 6 } },
				},
			};
			const changes = { system: { attributes: { wounds: { value: 3 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorDying).not.toHaveBeenCalled();
			expect(rule.onActorKilled).not.toHaveBeenCalled();
		});

		it('ignores wounds-only updates while HP is above 0', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: {
					attributes: { hp: { value: 10, max: 20 }, wounds: { value: 6, max: 6 } },
				},
			};
			const changes = { system: { attributes: { wounds: { value: 6 } } } };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorKilled).not.toHaveBeenCalled();
			expect(rule.onActorWounded).not.toHaveBeenCalled();
		});

		it('does nothing when HP was not part of the update', async () => {
			const rule = createMockRule();
			const actor = {
				rules: [rule],
				system: { attributes: { hp: { value: 10, max: 20 } } },
			};
			const changes = { name: 'Renamed' };

			const handler = handlers.get('updateActor');
			handler?.(actor, changes);
			await Promise.resolve();

			expect(rule.onActorKilled).not.toHaveBeenCalled();
			expect(rule.onActorWounded).not.toHaveBeenCalled();
		});
	});

	describe('nimble.rest / nimble.initiativeRolled / nimble.saveResolved', () => {
		it('dispatches onRest', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };

			const handler = handlers.get('nimble.rest');
			handler?.({ actor, restType: 'safe' });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onRest).toHaveBeenCalledTimes(1);
		});

		it('dispatches onInitiativeRolled', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };

			const handler = handlers.get('nimble.initiativeRolled');
			handler?.({ actor, combatant: {} });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onInitiativeRolled).toHaveBeenCalledTimes(1);
		});

		it('dispatches onSaveResolved', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };

			const handler = handlers.get('nimble.saveResolved');
			handler?.({ actor, saveType: 'strength', outcome: 'fail' });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onSaveResolved).toHaveBeenCalledTimes(1);
		});
	});

	describe('nimble.useItem → onItemActivated', () => {
		it('calls onItemActivated on each rule of the source actor', async () => {
			const rule = createMockRule();
			const sourceActor = { rules: [rule] };
			const sourceItem = { actor: sourceActor, name: 'Rage' };

			const handler = handlers.get('nimble.useItem');
			expect(handler).toBeDefined();
			handler?.(sourceItem, null, { rolls: [], targets: [] });
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onItemActivated).toHaveBeenCalledTimes(1);
			const ctx = rule.onItemActivated.mock.calls[0]?.[0];
			expect(ctx).toMatchObject({ sourceItem, sourceActor });
		});

		it('no-ops gracefully when the item has no parent actor', async () => {
			const handler = handlers.get('nimble.useItem');
			expect(() =>
				handler?.({ actor: null, name: 'Stray' }, null, { rolls: [], targets: [] }),
			).not.toThrow();
			await Promise.resolve();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = createMockRule();
			const sourceActor = { rules: [rule] };
			const sourceItem = { actor: sourceActor, name: 'Rage' };

			const handler = handlers.get('nimble.useItem');
			handler?.(sourceItem, null, { rolls: [], targets: [] });
			await Promise.resolve();

			expect(rule.onItemActivated).not.toHaveBeenCalled();
		});
	});

	describe('updateCombat / deleteCombat → onEncounterEnd', () => {
		function buildCombatWithCombatants(
			actors: Array<{ rules: RuleLike[] }>,
			id = `combat-${Math.random().toString(36).slice(2, 10)}`,
		) {
			return {
				id,
				combatants: { contents: actors.map((actor) => ({ actor })) },
			} as unknown as Combat;
		}

		it('fires onRoundChanged on each combatant when the round counter changes', async () => {
			const ruleA = createMockRule();
			const ruleB = createMockRule();
			const combat = buildCombatWithCombatants([{ rules: [ruleA] }, { rules: [ruleB] }]);

			const handler = handlers.get('updateCombat');
			handler?.(combat, { round: 1, turn: 0 });
			await Promise.resolve();
			await Promise.resolve();

			expect(ruleA.onRoundChanged).toHaveBeenCalledTimes(1);
			expect(ruleA.onRoundChanged.mock.calls[0][0]).toMatchObject({ round: 1 });
			expect(ruleB.onRoundChanged).toHaveBeenCalledTimes(1);
			expect(ruleA.onEncounterEnd).not.toHaveBeenCalled();
		});

		it('does not fire onRoundChanged when the update has no round change', async () => {
			const rule = createMockRule();
			const combat = buildCombatWithCombatants([{ rules: [rule] }]);

			handlers.get('updateCombat')?.(combat, { turn: 2 });
			await Promise.resolve();

			expect(rule.onRoundChanged).not.toHaveBeenCalled();
		});

		it('fires onEncounterEnd on each combatant when updateCombat indicates the combat ended', async () => {
			const ruleA = createMockRule();
			const ruleB = createMockRule();
			const actorA = { rules: [ruleA] };
			const actorB = { rules: [ruleB] };
			const combat = buildCombatWithCombatants([actorA, actorB]);

			const handler = handlers.get('updateCombat');
			expect(handler).toBeDefined();
			handler?.(combat, { started: false });
			await Promise.resolve();
			await Promise.resolve();

			expect(ruleA.onEncounterEnd).toHaveBeenCalledTimes(1);
			expect(ruleB.onEncounterEnd).toHaveBeenCalledTimes(1);
		});

		it('does not double-fire when deleteCombat follows an updateCombat end transition', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combat = buildCombatWithCombatants([actor]);

			handlers.get('updateCombat')?.(combat, { started: false });
			handlers.get('deleteCombat')?.(combat);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onEncounterEnd).toHaveBeenCalledTimes(1);
		});

		it('fires onEncounterEnd from deleteCombat alone as fallback', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combat = buildCombatWithCombatants([actor]);

			handlers.get('deleteCombat')?.(combat);
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onEncounterEnd).toHaveBeenCalledTimes(1);
		});

		it('ignores updateCombat events that are not end transitions', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combat = buildCombatWithCombatants([actor]);

			handlers.get('updateCombat')?.(combat, { round: 3 });
			await Promise.resolve();

			expect(rule.onEncounterEnd).not.toHaveBeenCalled();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combat = buildCombatWithCombatants([actor]);

			handlers.get('updateCombat')?.(combat, { started: false });
			await Promise.resolve();

			expect(rule.onEncounterEnd).not.toHaveBeenCalled();
		});

		it('does not pollute the dedup set when combat.id is missing', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combatA = {
				id: undefined,
				combatants: { contents: [{ actor }] },
			} as unknown as Combat;
			const combatB = buildCombatWithCombatants([actor]);

			// First update with no id should not block a subsequent legit combat-end.
			handlers.get('updateCombat')?.(combatA, { started: false });
			handlers.get('updateCombat')?.(combatB, { started: false });
			await Promise.resolve();
			await Promise.resolve();

			// One fire from combatA (no-id dispatch still happens), one from combatB.
			expect(rule.onEncounterEnd).toHaveBeenCalledTimes(2);
		});
	});

	describe('nimble.conditionApplied → onActorDying', () => {
		it('fires onActorDying on the target actor’s rules when condition === "dying"', async () => {
			const rule = createMockRule();
			const targetActor = { rules: [rule] };

			const handler = handlers.get('nimble.conditionApplied');
			expect(handler).toBeDefined();
			handler?.({
				target: targetActor,
				condition: 'dying',
				effect: null,
				source: { name: 'Grievous Wound' },
				rule: null,
			});
			await Promise.resolve();
			await Promise.resolve();

			expect(rule.onActorDying).toHaveBeenCalledTimes(1);
		});

		it('does not fire for other conditions', async () => {
			const rule = createMockRule();
			const targetActor = { rules: [rule] };

			handlers.get('nimble.conditionApplied')?.({
				target: targetActor,
				condition: 'dazed',
				effect: null,
				source: null,
				rule: null,
			});
			await Promise.resolve();

			expect(rule.onActorDying).not.toHaveBeenCalled();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = createMockRule();
			const targetActor = { rules: [rule] };

			handlers.get('nimble.conditionApplied')?.({
				target: targetActor,
				condition: 'dying',
				effect: null,
				source: null,
				rule: null,
			});
			await Promise.resolve();

			expect(rule.onActorDying).not.toHaveBeenCalled();
		});
	});

	describe('nimble.movementFinished → onMovementFinished', () => {
		const gameStub = game as unknown as {
			user?: { id: string; isGM: boolean };
			users?: { activeGM?: { id: string } | null };
		};

		function makeRecord(moverActor: unknown, sceneTokens: unknown[]) {
			const token = { actor: moverActor, parent: { tokens: sceneTokens } };
			return { token, actor: moverActor, kind: 'regular', spaces: 2 };
		}

		function makeMoverRecord(moverToken: { actor: unknown }, sceneTokens: unknown[]) {
			Object.assign(moverToken, { parent: { tokens: sceneTokens } });
			return { token: moverToken, actor: moverToken.actor, kind: 'regular', spaces: 2 };
		}

		async function fire(record: unknown): Promise<void> {
			await handlers.get('nimble.movementFinished')?.(record);
		}

		beforeEach(() => {
			gameStub.user = { id: 'gm', isGM: true };
			gameStub.users = { activeGM: { id: 'gm' } };
		});

		afterEach(() => {
			gameStub.user = undefined;
			gameStub.users = undefined;
		});

		it('dispatches to the mover first and then to every other actor on the scene', async () => {
			const order: string[] = [];
			const moverRule = createMockRule();
			moverRule.onMovementFinished.mockImplementation(async () => {
				order.push('mover');
			});
			const watcherRule = createMockRule();
			watcherRule.onMovementFinished.mockImplementation(async () => {
				order.push('watcher');
			});
			const mover = { rules: [moverRule] };
			const watcher = { rules: [watcherRule] };
			const moverToken = { actor: mover };
			const watcherToken = { actor: watcher };

			await fire(makeMoverRecord(moverToken, [watcherToken, moverToken]));

			expect(order).toEqual(['mover', 'watcher']);
			expect(moverRule.onMovementFinished).toHaveBeenCalledWith(
				expect.objectContaining({ isMover: true, actor: mover, token: moverToken }),
			);
			expect(watcherRule.onMovementFinished).toHaveBeenCalledWith(
				expect.objectContaining({ isMover: false, actor: watcher, token: watcherToken }),
			);
		});

		it('dispatches once per actor when several tokens share one', async () => {
			const rule = createMockRule();
			const shared = { rules: [rule] };
			const mover = { rules: [createMockRule()] };

			await fire(makeRecord(mover, [{ actor: shared }, { actor: shared }, { actor: null }]));

			expect(rule.onMovementFinished).toHaveBeenCalledTimes(1);
		});

		it('does nothing on a client that is not the active GM', async () => {
			gameStub.users = { activeGM: { id: 'someone-else' } };
			const rule = createMockRule();
			const mover = { rules: [rule] };

			await fire(makeRecord(mover, []));

			expect(rule.onMovementFinished).not.toHaveBeenCalled();
		});

		it('does nothing when movement tracking is off', async () => {
			settingsGet.mockImplementation(
				(_scope: string, key: string) => key !== 'automation.movementTracking',
			);
			const rule = createMockRule();
			const mover = { rules: [rule] };

			await fire(makeRecord(mover, []));

			expect(rule.onMovementFinished).not.toHaveBeenCalled();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockImplementation(
				(_scope: string, key: string) => key !== 'automation.applyRuleEffects',
			);
			const rule = createMockRule();
			const mover = { rules: [rule] };

			await fire(makeRecord(mover, []));

			expect(rule.onMovementFinished).not.toHaveBeenCalled();
		});
	});

	describe('nimble.dicePool.changed → onPoolGain', () => {
		async function fire(payload: unknown): Promise<void> {
			await handlers.get('nimble.dicePool.changed')?.(payload);
		}

		it('dispatches the bare pool identifier and label when the pool gains dice', async () => {
			const first = createMockRule();
			const second = createMockRule();
			const actor = { rules: [first, second] };

			await fire({
				actor,
				poolId: 'actor:fury',
				poolLabel: 'Fury Dice',
				previousFaces: [2],
				newFaces: [2, 5],
			});

			expect(first.onPoolGain).toHaveBeenCalledWith({
				actor,
				poolIdentifier: 'fury',
				poolLabel: 'Fury Dice',
			});
			expect(second.onPoolGain).toHaveBeenCalledTimes(1);
		});

		it('keeps an identifier that has no actor prefix', async () => {
			const rule = createMockRule();

			await fire({ actor: { rules: [rule] }, poolId: 'fury', previousFaces: [], newFaces: [3] });

			expect(rule.onPoolGain).toHaveBeenCalledWith(
				expect.objectContaining({ poolIdentifier: 'fury' }),
			);
		});

		it('does not dispatch when the pool did not gain dice', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };

			await fire({ actor, poolId: 'fury', previousFaces: [2, 4], newFaces: [2] });
			await fire({ actor, poolId: 'fury', previousFaces: [2], newFaces: [6] });

			expect(rule.onPoolGain).not.toHaveBeenCalled();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockImplementation(
				(_scope: string, key: string) => key !== 'automation.applyRuleEffects',
			);
			const rule = createMockRule();

			await fire({ actor: { rules: [rule] }, poolId: 'fury', previousFaces: [], newFaces: [3] });

			expect(rule.onPoolGain).not.toHaveBeenCalled();
		});
	});

	describe('nimbleCombatTurnStart → onActiveGmTurnStart', () => {
		async function fire(combatant: unknown): Promise<void> {
			await handlers.get('nimbleCombatTurnStart')?.(combatant);
		}

		it('dispatches the combat, combatant and actor to the actor rules', async () => {
			const rule = createMockRule();
			const actor = { rules: [rule] };
			const combat = { id: 'combat' };
			const combatant = { actor, combat };

			await fire(combatant);

			expect(rule.onActiveGmTurnStart).toHaveBeenCalledWith({ combat, combatant, actor });
			expect(rule.onTurnStart).not.toHaveBeenCalled();
		});

		it('does nothing for a combatant without an actor', async () => {
			await expect(fire({ actor: null, combat: {} })).resolves.toBeUndefined();
		});

		it('skips dispatch when the auto-apply setting is disabled', async () => {
			settingsGet.mockReturnValue(false);
			const rule = createMockRule();

			await fire({ actor: { rules: [rule] }, combat: {} });

			expect(rule.onActiveGmTurnStart).not.toHaveBeenCalled();
		});
	});
});
