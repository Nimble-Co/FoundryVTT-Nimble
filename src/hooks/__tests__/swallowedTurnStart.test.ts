import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, CardEventMoment } from '#types/cardEvent.d.ts';

const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);
const isRuleAutomationEnabled = vi.fn(() => true);

type Handler = (combatant: unknown, place?: unknown) => Promise<void>;

async function register(): Promise<Handler> {
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', () => ({ addMomentEvents }));
	vi.doMock('../../settings/automationSettings.js', () => ({ isRuleAutomationEnabled }));
	let handler: Handler | undefined;
	(Hooks.on as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		(event: string, callback: Handler) => {
			if (event === 'nimbleCombatTurnStart') handler = callback;
			return 1;
		},
	);
	const { registerSwallowedTurnStartHooks } = await import('../swallowedTurnStart.js');
	registerSwallowedTurnStartHooks();
	return handler as Handler;
}

function swallowedCombatant(swallowed = true) {
	const actor = {
		uuid: 'Actor.hero',
		name: 'Tessa',
		statuses: new Set(swallowed ? ['swallowed'] : []),
		applyDamage: vi.fn(async (_amount: number) => undefined),
	};
	const combat = { id: 'combat1', round: 2, turn: 0, turns: [] };
	return { actor, combatant: { id: 'cHero', name: 'Tessa', combat, actor } };
}

describe('Swallowed damage at turn start', () => {
	let create: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		addMomentEvents.mockClear();
		isRuleAutomationEnabled.mockReturnValue(true);
		create = vi.fn(async () => ({}));
		Object.assign(ChatMessage, { create });
	});

	it('deals the damage and adds a line to the card of that turn start, with no card of its own', async () => {
		const handler = await register();
		const { actor, combatant } = swallowedCombatant();

		await handler(combatant, { round: 2, turn: 0 });

		expect(actor.applyDamage).toHaveBeenCalledWith(20);
		expect(create).not.toHaveBeenCalled();
		const [moment, events] = addMomentEvents.mock.calls[0] as [CardEventMoment, CardEvent[]];
		expect(moment).toEqual({
			key: 'combat1:2:cHero:turnStart',
			heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnStart', data: { name: 'Tessa' } },
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			kind: 'damage',
			text: { key: 'NIMBLE.chat.swallowedDamage.text', data: { name: 'Tessa', amount: 20 } },
			cause: { key: 'NIMBLE.chat.swallowedDamage.cause' },
		});
	});

	it('uses the same moment key as the Lasts Until ends of that turn start', async () => {
		const handler = await register();
		const { combatant } = swallowedCombatant();
		const { turnMoment } = await import('#utils/lastsUntil/turnMoment.js');

		await handler(combatant);

		expect((addMomentEvents.mock.calls[0] as [CardEventMoment])[0]).toEqual(
			turnMoment('turnStart', combatant)?.moment,
		);
	});

	it('a creature that is not Swallowed, or rules automation off: no damage, no line', async () => {
		const handler = await register();
		const free = swallowedCombatant(false);
		await handler(free.combatant);
		isRuleAutomationEnabled.mockReturnValue(false);
		const held = swallowedCombatant();
		await handler(held.combatant);

		expect(free.actor.applyDamage).not.toHaveBeenCalled();
		expect(held.actor.applyDamage).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});
});
