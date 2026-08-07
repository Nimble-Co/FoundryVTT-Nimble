import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * Coverage of the card's Roll Damage button: the damage a trap-style spell
 * posts unrolled, rolled later from the card and written back onto the node.
 * Only the dice and the persistence boundary (`message.update`) are stubbed.
 */

const globals = globalThis as unknown as Record<string, unknown>;

const BaseRoll = globals.Roll as new (
	formula: string,
	data?: unknown,
) => { evaluateSync: () => unknown };

type MockedMessage = NimbleChatMessage & { update: ReturnType<typeof vi.fn> };

function deferredDamageNode(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trap-damage',
		type: 'damage',
		damageType: 'necrotic',
		formula: '3d12',
		deferredRoll: true,
		canCrit: false,
		canMiss: false,
		parentNode: null,
		parentContext: null,
		...overrides,
	};
}

function createMessage(nodes: Array<Record<string, unknown>> = [deferredDamageNode()]) {
	const message = new NimbleChatMessage({
		type: 'spell',
		author: { id: 'caster-user' },
		speaker: { actor: 'actor-shadowmancer' },
		system: {
			targets: ['Scene.scene.Token.victim'],
			isCritical: false,
			isMiss: false,
			activation: { effects: nodes, targets: { count: 1 } },
		},
	} as unknown as ChatMessage.CreateData) as MockedMessage;

	message.update = vi.fn().mockResolvedValue(undefined);
	(message as unknown as { _source: { rolls: string[] } })._source = { rolls: [] };
	return message;
}

/** What the card wrote back to the node, or undefined if it wrote nothing. */
function patchedNode(message: MockedMessage, nodeId = 'trap-damage') {
	const payload = message.update.mock.calls[0]?.[0] as
		| { system: { activation: { effects: Array<{ id: string; roll?: { total: number } }> } } }
		| undefined;
	return payload?.system.activation.effects.find((effect) => effect.id === nodeId);
}

beforeEach(() => {
	vi.clearAllMocks();

	// The shared Roll mock only resolves a formula in `evaluateSync` and its
	// `toJSON` omits `class`, which is the card's "this roll is real" signal.
	globals.Roll = class SerializableRoll extends BaseRoll {
		async evaluate() {
			this.evaluateSync();
			return this;
		}

		toJSON() {
			return { class: 'Roll', formula: '3d12', total: 21 };
		}
	};

	(globals.game as { user: { isGM: boolean; id: string } }).user = {
		isGM: false,
		id: 'caster-user',
	};
	(globals.game as { actors: unknown }).actors = {
		get: vi.fn(() => ({ getRollData: () => ({ level: 5 }) })),
	};
});

describe('rollDeferredDamage', () => {
	it('writes the rolled damage onto the node that was left unrolled', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(patchedNode(message)?.roll).toMatchObject({ class: 'Roll', total: 21 });
	});

	it('appends the roll to the message rolls source', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as { rolls: string[] };
		expect(payload.rolls).toHaveLength(1);
		expect(JSON.parse(payload.rolls[0])).toMatchObject({ class: 'Roll', total: 21 });
	});

	it('lets the GM roll a card they did not author', async () => {
		(globals.game as { user: { isGM: boolean; id: string } }).user = {
			isGM: true,
			id: 'gm-user',
		};
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(message.update).toHaveBeenCalled();
	});

	it('refuses a user who is neither the author nor a GM', async () => {
		(globals.game as { user: { isGM: boolean; id: string } }).user = {
			isGM: false,
			id: 'bystander-user',
		};
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a node that already carries a roll, so a second click cannot reroll it', async () => {
		const message = createMessage([
			deferredDamageNode({ roll: { class: 'Roll', formula: '3d12', total: 9 } }),
		]);

		await message.rollDeferredDamage('trap-damage');

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses a damage node that was never deferred', async () => {
		const message = createMessage([deferredDamageNode({ deferredRoll: false })]);

		await message.rollDeferredDamage('trap-damage');

		expect(message.update).not.toHaveBeenCalled();
	});

	it('leaves the rest of the card untouched', async () => {
		const concentration = {
			id: 'concentration-node',
			type: 'condition',
			condition: 'concentration',
			parentNode: null,
			parentContext: null,
		};
		const message = createMessage([concentration, deferredDamageNode()]);

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as {
			system: { activation: { effects: Array<Record<string, unknown>> } };
		};
		expect(payload.system.activation.effects).toHaveLength(2);
		expect(payload.system.activation.effects[0]).toMatchObject({
			type: 'condition',
			condition: 'concentration',
		});
	});
});
