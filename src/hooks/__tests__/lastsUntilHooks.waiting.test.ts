import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { endEffectsMock, waitEndEffectsMock } = vi.hoisted(() => ({
	endEffectsMock: vi.fn(async (..._args: unknown[]) => true),
	waitEndEffectsMock: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('../../utils/lastsUntil/endEffects.js', () => ({
	endEffects: endEffectsMock,
	endEffectsAt: vi.fn(async () => undefined),
	waitEndEffects: waitEndEffectsMock,
}));
vi.mock('../../utils/damage/turnDamage.js', () => ({ dealTurnDamage: vi.fn(async () => {}) }));
vi.mock('../../utils/saveRequest/saveRequests.js', () => ({ requestSaves: vi.fn(async () => {}) }));
vi.mock('../../utils/lastsUntil/lastsUntilEvents.js', () => ({
	eventHeading: (event: string, names: { name?: string | null }) => `${event}:${names.name}`,
	fireEvent: vi.fn(),
	fireItemUseEvents: vi.fn(),
}));

type HookCallback = (...args: unknown[]) => unknown;

const game = (globalThis as unknown as { game: Record<string, unknown> }).game;
let hooks: Map<string, HookCallback>;

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	game.user = { isActiveGM: true };
	game.settings = { get: () => false };
	hooks = new Map();
	(Hooks.on as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		(event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		},
	);
	const { default: registerLastsUntilHooks } = await import('../lastsUntilHooks.js');
	registerLastsUntilHooks();
});

afterEach(() => {
	delete game.settings;
});

describe('an inactive round with Feature Effects off', () => {
	it('ends nothing: the effect gets one waiting line on the card of the turn end', () => {
		const combatants: Record<string, unknown>[] = [];
		const combat = { id: 'combat1', round: 2, turn: 0, turns: combatants };
		Object.assign(combat, { combatants: { contents: combatants } });
		const idle = {
			active: true,
			start: { combat: 'combat1', round: 1 },
			lastsUntil: [{ kind: 'event', event: 'inactiveRound', who: 'holder' }],
			getFlag: () => undefined,
		};
		const goblin = {
			id: 'cGoblin',
			name: 'Goblin',
			type: 'npc',
			combat,
			actor: { type: 'npc', effects: [idle] },
			flags: {},
		};
		combatants.push(goblin);

		hooks.get('nimbleCombatTurnEnd')?.(goblin, { round: 2 });

		expect(endEffectsMock).not.toHaveBeenCalled();
		expect(waitEndEffectsMock).toHaveBeenCalledWith(
			[idle],
			{
				key: 'combat1:2:cGoblin:turnEnd',
				heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnEnd', data: { name: 'Goblin' } },
				reason: 'inactiveRound:Goblin',
			},
			undefined,
			{ once: true },
		);
	});
});
