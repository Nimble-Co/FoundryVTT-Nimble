import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { EffectNode } from '#types/effectTree.js';
import { EFFECT_RECREATED_OPTION } from '#utils/actor/applyConditionToActor.js';

const applyEffectFromCard = vi.fn();
const forgetAppliedEffect = vi.fn(async (..._args: unknown[]) => {});
const takeBackStack = vi.fn(async (..._args: unknown[]) => {});
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
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
let host: { id: string; system: object; flags?: object };
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
	replaceCardEvent.mockClear();
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
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		replaceCardEvent,
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
	vi.doUnmock('#utils/chat/cardEvents.js');
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

	it('a take-back also removes the "At N stacks" effect that the fail gave', async () => {
		const stone = { uuid: 'Actor.tessa.ActiveEffect.stone', delete: vi.fn(async () => {}) };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === counterEffect.uuid ? counterEffect : uuid === stone.uuid ? stone : null,
			),
		);
		applyEffectFromCard.mockImplementationOnce(async () => [
			{
				effectUuid: counterEffect.uuid,
				actorName: 'Tessa',
				stacks: 3,
				stackReached: {
					count: 3,
					stackedName: 'Dazed',
					gainedName: 'Stone',
					gainedUuid: stone.uuid,
				},
			},
		]);

		await resolved('fail');
		expect(saveCard.flags[SYSTEM_ID].saverSteps).toEqual([
			{ stepId: 'counter', effectUuid: counterEffect.uuid, gainedUuid: stone.uuid },
		]);
		await resolved('pass');

		expect(takeBackStack).toHaveBeenCalledWith(counterEffect);
		expect(stone.delete).toHaveBeenCalledTimes(1);
	});

	it('a take-back marks the "At N stacks" line on the card undone, as its Undo does', async () => {
		const stone = { uuid: 'Actor.tessa.ActiveEffect.stone', delete: vi.fn(async () => {}) };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === counterEffect.uuid ? counterEffect : uuid === stone.uuid ? stone : null,
			),
		);
		const line = {
			id: 'stackGain.Actor.tessa.5',
			kind: 'stackGain',
			icon: 'fa-solid fa-layer-group',
			text: { key: 'NIMBLE.chat.stackGain.gains' },
			at: 5,
			action: {
				kind: 'stackGain',
				holderUuid: 'Actor.tessa',
				holderName: 'Tessa',
				count: 3,
				stackedName: 'Dazed',
				gainedName: 'Stone',
				state: 'gained',
				gainedUuid: stone.uuid,
			},
		};
		host = { ...host, flags: { [SYSTEM_ID]: { events: [line] } } } as typeof host;
		applyEffectFromCard.mockImplementationOnce(async () => [
			{
				effectUuid: counterEffect.uuid,
				actorName: 'Tessa',
				stackReached: {
					count: 3,
					stackedName: 'Dazed',
					gainedName: 'Stone',
					gainedUuid: stone.uuid,
				},
			},
		]);

		await resolved('fail');
		await resolved('pass');

		expect(stone.delete).toHaveBeenCalledTimes(1);
		expect(replaceCardEvent).toHaveBeenCalledWith(host, line.id, {
			...line,
			action: { ...line.action, state: 'undone' },
		});
	});

	it('a take-back puts back the older copy that the fail replaced', async () => {
		const create = vi.fn(async () => []);
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create },
		};
		const holder = { uuid: 'Actor.tessa', effects: new Map() };
		const counter = { ...counterEffect, parent: holder };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === counterEffect.uuid ? counter : null)),
		);
		takeBackStack.mockImplementationOnce(async () => {
			vi.stubGlobal(
				'fromUuidSync',
				vi.fn(() => null),
			);
		});
		const old = { _id: 'old', name: 'Counter' };
		applyEffectFromCard.mockImplementationOnce(async () => [
			{ effectUuid: counterEffect.uuid, actorName: 'Tessa', replaced: [old] },
		]);

		await resolved('fail');
		expect(saveCard.flags[SYSTEM_ID].saverSteps).toEqual([
			{ stepId: 'counter', effectUuid: counterEffect.uuid, replaced: [old] },
		]);
		await resolved('pass');

		expect(takeBackStack).toHaveBeenCalledWith(counter);
		expect(create).toHaveBeenCalledWith([old], {
			parent: holder,
			keepId: true,
			[EFFECT_RECREATED_OPTION]: true,
		});
	});

	it('puts back nothing while a stack of the new copy stays', async () => {
		const create = vi.fn(async () => []);
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create },
		};
		const counter = { ...counterEffect, parent: { uuid: 'Actor.tessa' } };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === counterEffect.uuid ? counter : null)),
		);
		applyEffectFromCard.mockImplementationOnce(async () => [
			{ effectUuid: counterEffect.uuid, actorName: 'Tessa', replaced: [{ _id: 'old' }] },
		]);

		await resolved('fail');
		await resolved('pass');

		expect(create).not.toHaveBeenCalled();
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
