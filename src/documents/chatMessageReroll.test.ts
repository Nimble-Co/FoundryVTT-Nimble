import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../dice/DamageRoll.js';
import localize from '../utils/localize.js';
import { NimbleChatMessage } from './chatMessage.js';

/**
 * The GM-side executor for Reroll rule entries: how it wires the gate and the
 * reroll step to the card. The step itself is tested in `rerollStep.test.ts`.
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
		flags?: Record<string, unknown>;
	} = {},
): MockedMessage {
	const roll = serializedRoll(params.isCritical ?? false, params.forceMiss ?? false);
	const message = new NimbleChatMessage({
		type: 'spell',
		flags: { nimble: params.flags ?? {} },
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

	it('sends a warning, and makes no roll, when the cost cannot be paid', async () => {
		setupWorld({ rerollCost: { ...FREE, manaCost: 1 } });
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.rerollCostUnpaid'),
		);
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

	describe('charge recovery follows the roll that stands', () => {
		const CRIT_GAVE_ONE = [{ poolId: 'actor:focus', trigger: 'onCriticalHit', change: 1 }];
		const ATTACK_FLAGS = { itemUuid: 'Item.blade', chargeRecoveryGiven: CRIT_GAVE_ONE };

		/** Give the attacker a pool that a crit refills by 1, holding `current`. */
		function withCritPool(world: World, current: number) {
			const recoveries = [{ trigger: 'onCriticalHit', mode: 'add', value: '1' }];
			const pool = {
				id: 'actor:focus',
				identifier: 'focus',
				scope: 'actor',
				sourceItemId: 'blade',
				sourceItemName: 'Blade',
				label: 'Focus',
				current,
				max: 3,
				seeded: true,
				recoveries,
			};
			const poolRule = {
				type: 'chargePool',
				id: 'pool-rule',
				identifier: 'focus',
				scope: 'actor',
				max: '3',
				initial: 'max',
				recoveries,
			};
			const blade = {
				id: 'blade',
				name: 'Blade',
				actor: world.attacker,
				rules: new Map([['0', poolRule]]),
				flags: {},
				update: vi.fn(async () => ({})),
			};
			Object.assign(world.attacker, {
				flags: { nimble: { chargePools: { 'actor:focus': pool } } },
				items: { contents: [blade], get: () => blade },
				getRollData: () => ({}),
				getDomain: () => new Set<string>(),
			});
			const lookup = globals().fromUuidSync.getMockImplementation() as
				| ((uuid: string) => unknown)
				| undefined;
			globals().fromUuidSync = vi.fn((uuid: string) =>
				uuid === 'Item.blade' ? blade : lookup?.(uuid),
			);
		}

		function focus(world: World): number {
			return foundry.utils.getProperty(
				world.attacker,
				'flags.nimble.chargePools.actor:focus.current',
			) as number;
		}

		it('takes back the crit recovery when a crit is rerolled to a hit', async () => {
			const world = setupWorld();
			withCritPool(world, 1);
			const message = createMessage({ isCritical: true, flags: ATTACK_FLAGS });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(focus(world)).toBe(0);
			expect(message.update).toHaveBeenCalledTimes(2);
			expect(message.update.mock.calls[1][0]).toEqual({ 'flags.nimble.chargeRecoveryGiven': [] });
		});

		it('keeps the crit recovery when the discarded crit still counts', async () => {
			const world = setupWorld({ discardedCritTriggers: true });
			withCritPool(world, 1);
			const message = createMessage({ isCritical: true, flags: ATTACK_FLAGS });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(focus(world)).toBe(1);
			expect(message.update).toHaveBeenCalledTimes(1);
		});

		it('gives the crit recovery when a hit is rerolled to a crit', async () => {
			const world = setupWorld();
			withCritPool(world, 1);
			const message = createMessage({ flags: { itemUuid: 'Item.blade' } });
			const evaluate = vi
				.spyOn(DamageRoll.prototype, 'evaluate')
				.mockImplementation(async function (this: DamageRoll) {
					Object.defineProperty(this, 'isCritical', { value: true });
					Object.defineProperty(this, 'isMiss', { value: false });
					return this as never;
				});

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			expect(focus(world)).toBe(2);
			expect(message.update.mock.calls[1][0]).toEqual({
				'flags.nimble.chargeRecoveryGiven': CRIT_GAVE_ONE,
			});
		});

		it('leaves charges alone on a card no item made', async () => {
			const world = setupWorld();
			withCritPool(world, 1);
			const message = createMessage({ isCritical: true });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(focus(world)).toBe(1);
			expect(message.update).toHaveBeenCalledTimes(1);
		});
	});

	describe('a discarded crit and when-crit abilities (#1009)', () => {
		it('keeps crit triggers an earlier reroll kept', async () => {
			setupWorld({ discardedCritTriggers: false });
			const message = createMessage({ discardedCritTriggers: true });

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(updatePayload(message).system.discardedCritTriggers).toBe(true);
		});
	});
});
