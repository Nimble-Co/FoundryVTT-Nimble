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
	onTurnStart: Mock;
	onTurnEnd: Mock;
	onActorKilled: Mock;
	onActorWounded: Mock;
	onSaveResolved: Mock;
	onRest: Mock;
	onInitiativeRolled: Mock;
}

function createMockRule(): RuleLike {
	return {
		onItemUsed: vi.fn().mockResolvedValue(undefined),
		onTurnStart: vi.fn().mockResolvedValue(undefined),
		onTurnEnd: vi.fn().mockResolvedValue(undefined),
		onActorKilled: vi.fn().mockResolvedValue(undefined),
		onActorWounded: vi.fn().mockResolvedValue(undefined),
		onSaveResolved: vi.fn().mockResolvedValue(undefined),
		onRest: vi.fn().mockResolvedValue(undefined),
		onInitiativeRolled: vi.fn().mockResolvedValue(undefined),
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
	});

	describe('automation.autoApplyConditions gating', () => {
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
	});

	describe('updateActor → onActorKilled/onActorWounded', () => {
		it('fires onActorKilled when HP changed and current HP ≤ 0', async () => {
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
			expect(rule.onActorWounded).not.toHaveBeenCalled();
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
});
