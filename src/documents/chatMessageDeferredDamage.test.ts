import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * Coverage of the card's Roll Damage button: the damage a trap-style spell
 * posts unrolled, rolled later from the card and written back onto the node.
 * Only the dice and the persistence boundary (`message.update`) are stubbed.
 */

const globals = globalThis as unknown as Record<string, unknown>;

/** The shared Roll mock DamageRoll is built on in tests. */
const RollMockPrototype = Object.getPrototypeOf(DamageRoll.prototype) as {
	toJSON(): Record<string, unknown>;
};

type EvaluableRoll = DamageRoll & { evaluateSync(): void; total: number };

/**
 * Resolve the formula the way the shared Roll mock does, and report the outcome
 * a test asked for. The mock never runs `_evaluate`, which is where the real
 * class decides crit and miss, so an outcome has to be stated rather than
 * rolled. Every other assertion here reads the real class's own work: the
 * rewritten formula, the serialized fields, the options it was handed.
 */
function stubEvaluate(outcome: { isCritical?: boolean; isMiss?: boolean } = {}) {
	vi.spyOn(DamageRoll.prototype, 'evaluate').mockImplementation(async function evaluate(
		this: EvaluableRoll,
	) {
		this.evaluateSync();
		if (outcome.isCritical !== undefined) this.isCritical = outcome.isCritical;
		if (outcome.isMiss !== undefined) this.isMiss = outcome.isMiss;
		return this as never;
	});
}

/** The options the card handed the DamageRoll it built, or undefined. */
function rolledWithOptions(): Record<string, unknown> | undefined {
	const constructed = vi.mocked(DamageRoll.prototype.evaluate).mock.instances[0] as
		| DamageRoll
		| undefined;
	return constructed?.options as Record<string, unknown> | undefined;
}

type MockedMessage = NimbleChatMessage & { update: ReturnType<typeof vi.fn> };

function deferredDamageNode(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trap-damage',
		type: 'damage',
		damageType: 'necrotic',
		formula: '3d12',
		deferredRoll: true,
		canCrit: true,
		canMiss: true,
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

	// The mock's `toJSON` omits `class`, which is the card's "this roll is real"
	// signal and the guard a second click trips on.
	vi.spyOn(RollMockPrototype, 'toJSON').mockImplementation(function toJSON(this: EvaluableRoll) {
		return { class: this.constructor.name, formula: this.formula, total: this.total };
	});
	stubEvaluate();

	(globals.game as { user: { isGM: boolean; id: string } }).user = {
		isGM: false,
		id: 'caster-user',
	};
	(globals.game as { actors: unknown }).actors = {
		get: vi.fn(() => ({ getRollData: () => ({ level: 5 }) })),
	};
	(globals.game as { dice3d?: unknown }).dice3d = undefined;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('rollDeferredDamage', () => {
	it('rolls the node own formula and writes the result onto it', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(patchedNode(message)?.roll).toMatchObject({
			class: 'DamageRoll',
			originalFormula: '3d12',
		});
	});

	it('resolves the formula against the casting actor roll data', async () => {
		// `@level` is 5 on the stubbed speaker, so a formula the card resolved
		// without the actor's data would total 2 instead of 7.
		const message = createMessage([deferredDamageNode({ formula: '2 + @level' })]);

		await message.rollDeferredDamage('trap-damage');

		expect(patchedNode(message)?.roll).toMatchObject({ total: 7 });
	});

	it('rolls zero rather than throwing when the node carries no formula', async () => {
		const message = createMessage([deferredDamageNode({ formula: '' })]);

		await message.rollDeferredDamage('trap-damage');

		expect(patchedNode(message)?.roll).toMatchObject({ formula: '0', total: 0 });
	});

	it('still rolls when the speaker actor is gone, just without roll data', async () => {
		(globals.game as { actors: { get: ReturnType<typeof vi.fn> } }).actors.get = vi.fn(() => null);
		const message = createMessage([deferredDamageNode({ formula: '2 + @level' })]);

		await message.rollDeferredDamage('trap-damage');

		// `@level` resolves to 0 with no actor, per the shared Roll mock.
		expect(patchedNode(message)?.roll).toMatchObject({ total: 2 });
	});

	it('appends the roll to the message rolls source', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as { rolls: string[] };
		expect(payload.rolls).toHaveLength(1);
		expect(JSON.parse(payload.rolls[0])).toMatchObject({
			class: 'DamageRoll',
			originalFormula: '3d12',
		});
	});

	it('replaces the card existing damage roll rather than leaving two behind', async () => {
		const message = createMessage();
		(message as unknown as { _source: { rolls: string[] } })._source = {
			rolls: [JSON.stringify({ class: 'DamageRoll', formula: '1d6', total: 4 })],
		};

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as { rolls: string[] };
		expect(payload.rolls).toHaveLength(1);
		expect(JSON.parse(payload.rolls[0])).toMatchObject({ originalFormula: '3d12' });
	});

	it('rolls damage that can crit and can miss, per the node flags', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(rolledWithOptions()).toMatchObject({ canCrit: true, canMiss: true });
	});

	it('splits off a primary die so the trap can crit, like any other attack', async () => {
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		// The class rewrites the formula it was given: an exploding primary die
		// plus the remainder. `3d12` coming back unrewritten would mean the roll
		// never treated the damage as an attack.
		expect(patchedNode(message)?.roll).toMatchObject({
			formula: '1d12x + 2d12',
			originalFormula: '3d12',
		});
	});

	it('forwards a node that opts out of crits and misses', async () => {
		const message = createMessage([deferredDamageNode({ canCrit: false, canMiss: false })]);

		await message.rollDeferredDamage('trap-damage');

		expect(rolledWithOptions()).toMatchObject({ canCrit: false, canMiss: false });
	});

	it('lets a node that states neither flag crit and miss', async () => {
		const node = deferredDamageNode();
		delete (node as Record<string, unknown>).canCrit;
		delete (node as Record<string, unknown>).canMiss;
		const message = createMessage([node]);

		await message.rollDeferredDamage('trap-damage');

		expect(rolledWithOptions()).toMatchObject({ canCrit: true, canMiss: true });
	});

	it('restates the card outcome from the deferred roll, since the activation had none', async () => {
		stubEvaluate({ isCritical: false, isMiss: true });
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as {
			system: { isCritical: boolean; isMiss: boolean };
		};
		expect(payload.system).toMatchObject({ isCritical: false, isMiss: true });
	});

	it('reads a crit off the deferred roll onto the card', async () => {
		stubEvaluate({ isCritical: true, isMiss: false });
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as { system: { isCritical: boolean } };
		expect(payload.system.isCritical).toBe(true);
	});

	it('writes booleans to the card even when the roll reports no outcome', async () => {
		const message = createMessage([deferredDamageNode({ canCrit: false, canMiss: false })]);

		await message.rollDeferredDamage('trap-damage');

		const payload = message.update.mock.calls[0][0] as {
			system: { isCritical: unknown; isMiss: unknown };
		};
		expect(payload.system).toMatchObject({ isCritical: false, isMiss: false });
	});

	it('throws the dice for Dice So Nice, which never saw the message being created', async () => {
		const showForRoll = vi.fn().mockResolvedValue(true);
		(globals.game as { dice3d?: unknown }).dice3d = { showForRoll };
		const message = createMessage();

		await message.rollDeferredDamage('trap-damage');

		expect(showForRoll).toHaveBeenCalledTimes(1);
		expect(showForRoll.mock.calls[0][0]).toMatchObject({ originalFormula: '3d12' });
	});

	it('does not throw dice for a click that rolled nothing', async () => {
		const showForRoll = vi.fn().mockResolvedValue(true);
		(globals.game as { dice3d?: unknown }).dice3d = { showForRoll };
		const message = createMessage([deferredDamageNode({ deferredRoll: false })]);

		await message.rollDeferredDamage('trap-damage');

		expect(showForRoll).not.toHaveBeenCalled();
	});

	it('refuses a card that is not an activation card', async () => {
		const message = createMessage();
		(message as unknown as { type: string }).type = 'skillCheck';

		await message.rollDeferredDamage('trap-damage');

		expect(message.canRollDeferredDamage()).toBe(false);
		expect(message.update).not.toHaveBeenCalled();
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
