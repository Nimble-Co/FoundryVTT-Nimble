import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../dice/DamageRoll.js';
import localize from '../utils/localize.js';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * The GM-side executor for Reroll rule entries: the gates it checks again,
 * the cost it pays and gives back, the new roll, and what it writes for the
 * card's history line and for when-crit abilities.
 */

const FREE = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 0,
	heroicReaction: '' as const,
};

const TARGET_TOKEN = 'Scene.scene.Token.victim';

type Globals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
	game: {
		user: { isGM: boolean; id: string };
		users: { get: ReturnType<typeof vi.fn> };
		actors?: { get: ReturnType<typeof vi.fn> };
	};
	ui: { notifications: { warn: ReturnType<typeof vi.fn> } };
};

function globals(): Globals {
	return globalThis as unknown as Globals;
}

function rerollRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'reroll',
		id: 'reroll-1',
		disabled: false,
		label: '',
		outcome: 'always',
		discardedCritTriggers: false,
		rerollCost: FREE,
		offersRerollOn: vi.fn((context: { side: string }) => context.side === 'target'),
		rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
		...overrides,
	};
}

function makeActor(uuid: string) {
	const actor = {
		uuid,
		type: 'character',
		name: uuid === 'Actor.attacker' ? 'Kael' : 'Brom',
		rules: [] as unknown[],
		system: { attributes: { wounds: { value: 0, max: 6 } } },
		testUserPermission: vi.fn(() => true),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

function rerollEntry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'entry-1',
		kind: 'reroll',
		source: 'rule',
		actorUuid: 'Actor.target',
		tokenUuid: null,
		targetTokenUuid: TARGET_TOKEN,
		side: 'target',
		label: 'Pocket Sand',
		ruleId: 'reroll-1',
		itemUuid: 'Item.sand',
		used: false,
		outcomeTrigger: 'always',
		...overrides,
	};
}

function serializedRoll(isCritical = false, forceMiss = false) {
	return {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		originalFormula: '1d6 + 2',
		total: 8,
		isCritical,
		isMiss: false,
		options: {
			canCrit: false,
			canMiss: false,
			rollMode: 0,
			netRollMode: 0,
			primaryDieModifier: 1,
			...(forceMiss ? { forceMiss } : {}),
		},
		data: {},
	};
}

type MockedMessage = NimbleChatMessage & {
	update: ReturnType<typeof vi.fn>;
	system: Record<string, unknown>;
};

function createMessage(
	params: {
		entries?: Array<Record<string, unknown>>;
		isCritical?: boolean;
		discardedCritTriggers?: boolean;
		targets?: string[];
		attackType?: string;
		forceMiss?: boolean;
	} = {},
): MockedMessage {
	const roll = serializedRoll(params.isCritical ?? false, params.forceMiss ?? false);
	const message = new NimbleChatMessage({
		type: 'spell',
		speaker: { scene: 'scene', token: 'attacker-token', actor: 'attacker' },
		system: {
			targets: params.targets ?? [TARGET_TOKEN],
			isCritical: params.isCritical ?? false,
			isMiss: false,
			discardedCritTriggers: params.discardedCritTriggers ?? false,
			activation: {
				effects: [
					{ id: 'damage-node', type: 'damage', parentNode: null, parentContext: null, roll },
				],
				targets: { count: 1, attackType: params.attackType ?? 'reach', distance: 1 },
			},
			incomingReactions: params.entries ?? [rerollEntry()],
		},
	} as unknown as ChatMessage.CreateData) as MockedMessage;
	message.update = vi.fn().mockResolvedValue(undefined);
	(message as unknown as { _source: { rolls: string[] } })._source = {
		rolls: [JSON.stringify(roll)],
	};
	Object.defineProperty(message, 'speaker', {
		value: { scene: 'scene', token: 'attacker-token', actor: 'attacker' },
	});
	return message;
}

interface World {
	attacker: ReturnType<typeof makeActor>;
	target: ReturnType<typeof makeActor>;
	rule: ReturnType<typeof rerollRule>;
}

function setupWorld(ruleOverrides: Record<string, unknown> = {}): World {
	const attacker = makeActor('Actor.attacker');
	const target = makeActor('Actor.target');
	const rule = rerollRule(ruleOverrides);
	const item = { rules: new Map([[rule.id, rule]]) };
	const byUuid: Record<string, unknown> = {
		'Actor.attacker': attacker,
		'Actor.target': target,
		'Item.sand': item,
		[TARGET_TOKEN]: { actor: target },
		'Scene.scene.Token.attacker-token': { actor: attacker },
	};
	globals().fromUuidSync = vi.fn((uuid: string) => byUuid[uuid] ?? null);
	return { attacker, target, rule };
}

function updatePayload(message: MockedMessage) {
	return message.update.mock.calls[0]?.[0] as {
		rolls: string[];
		system: {
			isCritical: boolean;
			incomingReactions: Array<Record<string, unknown>>;
			lastReroll?: Record<string, unknown>;
			discardedCritTriggers?: boolean;
			activation: { effects: Array<Record<string, unknown>> };
		};
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	globals().game.user = { isGM: true, id: 'gm-user' };
	globals().game.users = {
		get: vi.fn((id: string) => {
			if (id === 'gm-user') return { isGM: true, id };
			if (id === 'player-1') return { isGM: false, id };
			return null;
		}),
	};
	globals().game.actors = { get: vi.fn(() => null) };
	globals().ui.notifications.warn = vi.fn();
});

describe('resolveRerollReaction', () => {
	it('rerolls the primary damage roll and marks the entry used', async () => {
		const { rule } = setupWorld();
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(rule.offersRerollOn).toHaveBeenCalledWith({ side: 'target', delivery: 'melee' });
		const payload = updatePayload(message);
		expect(payload.system.activation.effects[0].discardedRoll).toEqual(serializedRoll());
		expect(payload.system.incomingReactions[0]).toMatchObject({ id: 'entry-1', used: true });
		expect(payload.system.lastReroll).toMatchObject({
			entryId: 'entry-1',
			itemUuid: 'Item.sand',
			label: 'Pocket Sand',
			actorUuid: 'Actor.target',
			previousWasCritical: false,
			usesLeft: null,
			woundsGained: 0,
		});
		expect(payload.system.discardedCritTriggers).toBe(false);
	});

	it('rolls the new roll with the rule changes on top of the first roll', async () => {
		setupWorld({
			rerollChanges: () => ({ rollModeChange: -1, primaryDieBonus: 2, extraDamage: '1d4' }),
		});
		const message = createMessage();
		const evaluate = vi.spyOn(DamageRoll.prototype, 'evaluate');

		await message.resolveRerollReaction('entry-1', 'gm-user');

		const rolled = evaluate.mock.contexts[0] as DamageRoll;
		evaluate.mockRestore();
		expect(rolled.originalFormula).toBe('1d6 + 2 + (1d4)');
		expect(rolled.options.primaryDieModifier).toBe(3);
		expect((rolled.options as { rollModeSources?: number[] }).rollModeSources).toEqual([0, -1]);
	});

	it('charges the cost and records the Wound gained', async () => {
		const { target } = setupWorld({ rerollCost: { ...FREE, woundCost: 1 } });
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(target.system.attributes.wounds.value).toBe(1);
		expect(updatePayload(message).system.lastReroll?.woundsGained).toBe(1);
	});

	it('gives the cost back when the reroll cannot be written', async () => {
		const { target } = setupWorld({ rerollCost: { ...FREE, woundCost: 1 } });
		const message = createMessage();
		message.update.mockRejectedValueOnce(new Error('write failed'));
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await message.resolveRerollReaction('entry-1', 'gm-user');

		consoleError.mockRestore();
		expect(target.system.attributes.wounds.value).toBe(0);
		expect(globals().ui.notifications.warn).toHaveBeenCalled();
	});

	it('refuses, and charges nothing, when the card outcome no longer matches', async () => {
		const { target } = setupWorld({
			outcome: 'criticalHit',
			rerollCost: { ...FREE, woundCost: 1 },
		});
		const message = createMessage({ isCritical: false });

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(target.system.attributes.wounds.value).toBe(0);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.rerollNoLongerAvailable'),
		);
	});

	it('refuses a roll that misses by force as a failed use', async () => {
		setupWorld();
		const message = createMessage({ forceMiss: true });

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.useFailed'),
		);
	});

	it('lets the attacker use a roller entry', async () => {
		setupWorld({ offersRerollOn: vi.fn((context: { side: string }) => context.side === 'roller') });
		const message = createMessage({
			entries: [
				rerollEntry({ actorUuid: 'Actor.attacker', targetTokenUuid: null, side: 'roller' }),
			],
		});

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).toHaveBeenCalledTimes(1);
	});

	it('refuses a player who does not own the actor', async () => {
		const { target } = setupWorld();
		target.testUserPermission.mockReturnValue(false);
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'player-1', true);

		expect(message.update).not.toHaveBeenCalled();
	});

	it('does nothing on a client that is not a GM', async () => {
		setupWorld();
		globals().game.user.isGM = false;
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
	});

	it('uses one entry once', async () => {
		setupWorld();
		const message = createMessage({ entries: [rerollEntry({ used: true })] });

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
	});

	it('adds a new entry for a feature that can still be used on the new roll', async () => {
		const { target, rule } = setupWorld();
		target.rules = [{ ...rule, item: { name: 'Pocket Sand', uuid: 'Item.sand' } }];
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		const entries = updatePayload(message).system.incomingReactions;
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({ id: 'entry-1', used: true });
		expect(entries[1]).toMatchObject({
			kind: 'reroll',
			ruleId: 'reroll-1',
			actorUuid: 'Actor.target',
			targetTokenUuid: TARGET_TOKEN,
			side: 'target',
			used: false,
		});
	});

	describe('a discarded crit and when-crit abilities (#1009)', () => {
		it('keeps the crit triggers when the rule says so and the discarded roll was a crit', async () => {
			setupWorld({ discardedCritTriggers: true });
			const message = createMessage({ isCritical: true });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			const { system } = updatePayload(message);
			expect(system.lastReroll?.previousWasCritical).toBe(true);
			expect(system.discardedCritTriggers).toBe(true);
		});

		it('drops the crit triggers when the rule does not keep them', async () => {
			setupWorld({ discardedCritTriggers: false });
			const message = createMessage({ isCritical: true });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(updatePayload(message).system.discardedCritTriggers).toBe(false);
		});

		it('has nothing to keep when the discarded roll was not a crit', async () => {
			setupWorld({ discardedCritTriggers: true });
			const message = createMessage({ isCritical: false });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(updatePayload(message).system.discardedCritTriggers).toBe(false);
		});

		it('keeps crit triggers an earlier reroll kept', async () => {
			setupWorld({ discardedCritTriggers: false });
			const message = createMessage({ discardedCritTriggers: true });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(updatePayload(message).system.discardedCritTriggers).toBe(true);
		});
	});
});
