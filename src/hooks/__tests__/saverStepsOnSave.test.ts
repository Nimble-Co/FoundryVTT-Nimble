import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';

const applyEffectFromCard = vi.fn();
const forgetAppliedEffect = vi.fn(async (..._args: unknown[]) => {});
const takeBackStack = vi.fn(async (..._args: unknown[]) => {});
let automation = true;

let followSaverSteps: typeof import('../saverStepsOnSave.js').followSaverSteps;

const step = (id: string, recipient: string, parentContext: string): EffectNode =>
	({
		id,
		type: 'applyEffect',
		effectId: 'fx',
		recipient,
		parentContext,
		parentNode: 'save1',
	}) as EffectNode;

const saveNode = {
	id: 'save1',
	type: 'savingThrow',
	saveType: 'will',
	parentContext: null,
	parentNode: null,
	on: {
		failedSave: [
			step('counter', 'savers', 'failedSave'),
			step('confused', 'targets', 'failedSave'),
		],
		passedSave: [step('steady', 'savers', 'passedSave')],
	},
} as unknown as EffectNode;

const tessa = { uuid: 'Actor.tessa', name: 'Tessa' };
const counterEffect = { uuid: 'Actor.tessa.ActiveEffect.count' };
let host: { id: string; system: object };
let saveCard: {
	id: string;
	flags: Record<string, Record<string, unknown>>;
	update: ReturnType<typeof vi.fn>;
};

const effectUuidOf = (stepId: string) =>
	stepId === 'counter' ? counterEffect.uuid : 'Actor.tessa.ActiveEffect.steady';

function messagesGet(id: string) {
	if (id === 'card1') return host;
	if (id === 'save-card') return saveCard;
	return undefined;
}

beforeEach(async () => {
	automation = true;
	applyEffectFromCard
		.mockReset()
		.mockImplementation(async (_card, node: { id: string }) => [
			{ effectUuid: effectUuidOf(node.id), actorName: 'Tessa' },
		]);
	forgetAppliedEffect.mockClear();
	takeBackStack.mockClear();
	host = { id: 'card1', system: { activation: { effects: [saveNode] } } };
	saveCard = {
		id: 'save-card',
		flags: { [SYSTEM_ID]: { askedBy: { cardId: 'card1', nodeId: 'save1' } } },
		update: vi.fn(async (changes: Record<string, unknown>) => {
			saveCard.flags[SYSTEM_ID].saverSteps = changes[`flags.${SYSTEM_ID}.saverSteps`];
		}),
	};
	(game as unknown as { messages: object }).messages = { get: messagesGet };
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === counterEffect.uuid ? counterEffect : null)),
	);
	vi.resetModules();
	vi.doMock('#utils/chat/applyEffectFromCard.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		applyEffectFromCard,
		forgetAppliedEffect,
	}));
	vi.doMock('#utils/actor/effectStacks.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		takeBackStack,
	}));
	vi.doMock('../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	({ followSaverSteps } = await import('../saverStepsOnSave.js'));
	vi.doUnmock('#utils/chat/applyEffectFromCard.js');
	vi.doUnmock('#utils/actor/effectStacks.js');
	vi.doUnmock('../../settings/automationSettings.js');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const resolved = (outcome: 'fail' | 'pass' | 'unknown') =>
	followSaverSteps({ actor: tessa as never, outcome, messageId: 'save-card', saveType: 'will' });

describe('followSaverSteps', () => {
	it('a fail puts on the steps for each creature that fails, on the saver only, and records them', async () => {
		await resolved('fail');

		expect(applyEffectFromCard).toHaveBeenCalledTimes(1);
		expect(applyEffectFromCard).toHaveBeenCalledWith(
			host,
			expect.objectContaining({ id: 'counter' }),
			{
				recipients: [tessa],
			},
		);
		expect(saveCard.update).toHaveBeenCalledWith({
			[`flags.${SYSTEM_ID}.saverSteps`]: [{ stepId: 'counter', effectUuid: counterEffect.uuid }],
		});
	});

	it('a pass puts on the steps for each creature that saves', async () => {
		await resolved('pass');

		expect(applyEffectFromCard).toHaveBeenCalledWith(
			host,
			expect.objectContaining({ id: 'steady' }),
			{
				recipients: [tessa],
			},
		);
	});

	it('a fail that becomes a pass takes the fail back once, and the same result again does nothing', async () => {
		await resolved('fail');
		await resolved('pass');
		await resolved('pass');

		expect(takeBackStack).toHaveBeenCalledTimes(1);
		expect(takeBackStack).toHaveBeenCalledWith(counterEffect);
		expect(forgetAppliedEffect).toHaveBeenCalledWith(host, 'counter', counterEffect.uuid);
		expect(applyEffectFromCard).toHaveBeenCalledTimes(2);
		expect(saveCard.flags[SYSTEM_ID].saverSteps).toEqual([
			{ stepId: 'steady', effectUuid: 'Actor.tessa.ActiveEffect.steady' },
		]);
	});

	it('a result no longer known takes everything back', async () => {
		await resolved('fail');
		await resolved('unknown');

		expect(takeBackStack).toHaveBeenCalledTimes(1);
		expect(saveCard.flags[SYSTEM_ID].saverSteps).toEqual([]);
	});

	it('does nothing for a save that no card asked for, or with Feature Effects off', async () => {
		saveCard.flags[SYSTEM_ID] = {};
		await resolved('fail');

		saveCard.flags[SYSTEM_ID] = { askedBy: { cardId: 'card1', nodeId: 'save1' } };
		automation = false;
		await resolved('fail');

		expect(applyEffectFromCard).not.toHaveBeenCalled();
	});
});
