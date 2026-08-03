import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../tests/helpers.js';
import { type CombatDefeatSyncTestGlobals, createHookCapture } from '../../tests/mocks/combat.js';

function globals() {
	return getTestGlobals<CombatDefeatSyncTestGlobals>();
}

type ChatMessageGlobal = {
	create: ReturnType<typeof vi.fn>;
	getSpeaker: ReturnType<typeof vi.fn>;
};

function stubChatMessage(): ChatMessageGlobal {
	const stub: ChatMessageGlobal = {
		create: vi.fn(async () => ({})),
		getSpeaker: vi.fn(() => ({})),
	};
	(globalThis as unknown as { ChatMessage: unknown }).ChatMessage = stub;
	return stub;
}

function makeRule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		type: 'poolGainMessage',
		disabled: false,
		poolIdentifier: 'fury',
		resolveMessage: () => 'Move up to 3 spaces for free.',
		...overrides,
	};
}

function makeActor(rules: Array<Record<string, unknown>>): unknown {
	return { type: 'character', rules };
}

function gainPayload(actor: unknown, overrides: Record<string, unknown> = {}) {
	return {
		actor,
		poolId: 'fury',
		previousFaces: [2],
		newFaces: [2, 4],
		...overrides,
	};
}

describe('registerPoolGainMessageHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	it('posts the resolved message when the pool gains dice', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const chat = stubChatMessage();
		const { registerPoolGainMessageHooks } = await import('./poolGainMessage.js');
		registerPoolGainMessageHooks();

		const actor = makeActor([makeRule()]);
		callbacks.get('nimble.dicePool.changed')?.(gainPayload(actor));

		expect(chat.create).toHaveBeenCalledTimes(1);
		const content = (chat.create.mock.calls[0]?.[0] as { content?: string })?.content ?? '';
		expect(content).toContain('Move up to 3 spaces for free.');
	});

	it('does not post when the pool shrank or stayed the same', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const chat = stubChatMessage();
		const { registerPoolGainMessageHooks } = await import('./poolGainMessage.js');
		registerPoolGainMessageHooks();

		const actor = makeActor([makeRule()]);
		callbacks.get('nimble.dicePool.changed')?.(
			gainPayload(actor, { previousFaces: [2, 4], newFaces: [2] }),
		);
		callbacks.get('nimble.dicePool.changed')?.(
			gainPayload(actor, { previousFaces: [2], newFaces: [6] }),
		);

		expect(chat.create).not.toHaveBeenCalled();
	});

	it('matches actor-scoped pool ids against the bare identifier', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const chat = stubChatMessage();
		const { registerPoolGainMessageHooks } = await import('./poolGainMessage.js');
		registerPoolGainMessageHooks();

		const actor = makeActor([makeRule()]);
		callbacks.get('nimble.dicePool.changed')?.(gainPayload(actor, { poolId: 'actor:fury' }));

		expect(chat.create).toHaveBeenCalledTimes(1);
	});

	it('does not post when chat-notification automation is off', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const chat = stubChatMessage();
		const { registerPoolGainMessageHooks } = await import('./poolGainMessage.js');
		registerPoolGainMessageHooks();

		(globals().game as { settings?: { get: () => boolean } }).settings = { get: () => false };
		try {
			const actor = makeActor([makeRule()]);
			callbacks.get('nimble.dicePool.changed')?.(gainPayload(actor));

			expect(chat.create).not.toHaveBeenCalled();
		} finally {
			(globals().game as { settings?: unknown }).settings = undefined;
		}
	});

	it('skips disabled rules, other pools, and failed predicates', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const chat = stubChatMessage();
		const { registerPoolGainMessageHooks } = await import('./poolGainMessage.js');
		registerPoolGainMessageHooks();

		const actor = makeActor([
			makeRule({ disabled: true }),
			makeRule({ poolIdentifier: 'judgment' }),
			makeRule({ appliesTo: () => false }),
		]);
		callbacks.get('nimble.dicePool.changed')?.(gainPayload(actor));

		expect(chat.create).not.toHaveBeenCalled();
	});
});
