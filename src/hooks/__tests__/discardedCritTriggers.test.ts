import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync } from '../../../tests/helpers.js';

const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

vi.stubGlobal('Hooks', {
	on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
		handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		return 1;
	}),
	once: vi.fn(),
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn((event: string, ...args: unknown[]) => {
		for (const handler of handlers.get(event) ?? []) handler(...args);
		return true;
	}),
});

const activeGm = { id: 'gm' };
vi.stubGlobal('game', {
	settings: { get: vi.fn(() => true) },
	user: { id: 'gm', isGM: true },
	users: { activeGM: activeGm },
	actors: { get: vi.fn(() => null) },
});

const tokens = new Map<string, { actor: unknown }>();
vi.stubGlobal(
	'fromUuidSync',
	vi.fn((uuid: string) => tokens.get(uuid) ?? null),
);

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	applyRefillToActorIfEligible: vi.fn(async () => {}),
}));

import { systemHookName } from '#system';
import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';
import { registerAttackedTriggerHooks } from '../dicePoolTriggers/attackedTrigger.js';
import { registerDiscardedCritTriggerHooks } from '../discardedCritTriggers.js';
import registerRuleEventDispatch from '../ruleEventDispatch.js';

interface TestCard {
	id: string;
	system: Record<string, unknown>;
	speaker: { actor: string | null };
	flags: Record<string, unknown>;
	update: Mock;
}

function createTarget() {
	const rule = {
		onAttackReceived: vi.fn().mockResolvedValue(undefined),
		onItemUsed: vi.fn().mockResolvedValue(undefined),
	};
	const actor = { type: 'character', rules: [rule] };
	tokens.set('Scene.s.Token.target', { actor });
	return { actor, rule };
}

/** A card whose `update` writes the system changes back, as the document does. */
function createCard(system: Record<string, unknown>): TestCard {
	const card: TestCard = {
		id: 'card',
		system: { targets: ['Scene.s.Token.target'], isCritical: false, ...system },
		speaker: { actor: null },
		flags: {},
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				card.system[path.replace(/^system\./, '')] = value;
			}
		}),
	};
	return card;
}

function emit(event: string, card: TestCard): void {
	for (const handler of handlers.get(event) ?? []) handler(card, {}, {}, 'gm');
}

function critRefills(actor: unknown): number {
	return (applyRefillToActorIfEligible as Mock).mock.calls.filter(
		([target, trigger]) => target === actor && trigger === 'onCritReceived',
	).length;
}

describe('discarded crit triggers on a reroll that misses', () => {
	beforeAll(() => {
		registerRuleEventDispatch();
		registerAttackedTriggerHooks();
		registerDiscardedCritTriggerHooks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		tokens.clear();
		activeGm.id = 'gm';
	});

	it('fires the target crit triggers once when the card is made with a miss', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isMiss: true, discardedCritTriggers: true });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).toHaveBeenCalledTimes(1);
		expect(rule.onAttackReceived).toHaveBeenCalledWith(
			expect.objectContaining({ targetActor: actor, isMiss: true, discardedCritTriggers: true }),
		);
		expect(critRefills(actor)).toBe(1);
		expect(applyRefillToActorIfEligible).not.toHaveBeenCalledWith(actor, 'onAttacked');
		expect(rule.onItemUsed).not.toHaveBeenCalled();
		expect(card.system.discardedCritTriggersFired).toBe(true);
	});

	it('fires them when a reroll on the card turns the discarded crit into a miss', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isCritical: true, isMiss: false, discardedCritTriggers: false });
		emit('createChatMessage', card);
		await flushAsync();
		expect(rule.onAttackReceived).not.toHaveBeenCalled();

		Object.assign(card.system, { isCritical: false, isMiss: true, discardedCritTriggers: true });
		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).toHaveBeenCalledTimes(1);
		expect(critRefills(actor)).toBe(1);
	});

	it('fires nothing at reroll time when the new roll hits', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isMiss: false, discardedCritTriggers: true });

		emit('createChatMessage', card);
		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).not.toHaveBeenCalled();
		expect(critRefills(actor)).toBe(0);
		expect(card.update).not.toHaveBeenCalled();
	});

	it('fires nothing when the reroll rule does not keep the crit triggers', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isMiss: true, discardedCritTriggers: false });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).not.toHaveBeenCalled();
		expect(critRefills(actor)).toBe(0);
	});

	it('does not fire again when the card is rerolled a second time', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isMiss: true, discardedCritTriggers: true });
		emit('createChatMessage', card);
		// A second update lands before the fired flag is written back.
		emit('updateChatMessage', card);
		await flushAsync();

		emit('updateChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).toHaveBeenCalledTimes(1);
		expect(critRefills(actor)).toBe(1);
		expect(card.update).toHaveBeenCalledTimes(1);
	});

	it('does not fire the target crit triggers again when a later hit applies damage', async () => {
		const { actor, rule } = createTarget();
		const card = createCard({ isMiss: true, discardedCritTriggers: true });
		emit('createChatMessage', card);
		await flushAsync();
		rule.onAttackReceived.mockClear();
		(applyRefillToActorIfEligible as Mock).mockClear();

		const sourceRule = { onItemUsed: vi.fn().mockResolvedValue(undefined) };
		for (const handler of handlers.get(systemHookName('damageApplied')) ?? []) {
			handler({
				sourceItem: {},
				sourceActor: { rules: [sourceRule] },
				targetActor: actor,
				card,
				isCritical: false,
				isMiss: false,
				discardedCritTriggers: true,
				discardedCritTriggersFired: card.system.discardedCritTriggersFired,
			});
		}
		await flushAsync();

		expect(rule.onAttackReceived).toHaveBeenCalledWith(
			expect.objectContaining({ discardedCritTriggers: false }),
		);
		expect(critRefills(actor)).toBe(0);
		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(actor, 'onAttacked');
		expect(sourceRule.onItemUsed).toHaveBeenCalledWith(
			expect.objectContaining({ discardedCritTriggers: true }),
		);
	});

	it('runs only on the active GM', async () => {
		const { rule } = createTarget();
		activeGm.id = 'other-gm';
		const card = createCard({ isMiss: true, discardedCritTriggers: true });

		emit('createChatMessage', card);
		await flushAsync();

		expect(rule.onAttackReceived).not.toHaveBeenCalled();
		expect(card.update).not.toHaveBeenCalled();
	});
});
