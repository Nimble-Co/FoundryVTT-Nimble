import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DamageRoll } from '../../dice/DamageRoll.js';
import localize from '../../utils/localize.js';
import { rollingRerollOf, stopRerollRolling } from '../../utils/rerollRolling.svelte.js';
import { NimbleChatMessage } from '../chatMessage.js';

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
		scenes?: { get: ReturnType<typeof vi.fn> };
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
		applyHealing: vi.fn(async () => undefined),
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
	};
	globals().fromUuidSync = vi.fn((uuid: string) => byUuid[uuid] ?? null);
	const attackerToken = { actor: attacker };
	globals().game.scenes = {
		get: vi.fn((id: string) =>
			id === 'scene'
				? {
						tokens: {
							get: (tokenId: string) => (tokenId === 'attacker-token' ? attackerToken : null),
						},
					}
				: null,
		),
	};
	return { attacker, target, rule };
}

function updatePayload(message: MockedMessage) {
	return message.update.mock.calls[0]?.[0] as {
		rolls: string[];
		system: {
			isCritical: boolean;
			incomingReactions: Array<Record<string, unknown>>;
			rerolls?: Array<Record<string, unknown>>;
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

		expect(rule.offersRerollOn).toHaveBeenCalledWith({
			side: 'target',
			roll: { kind: 'attack', delivery: 'melee' },
		});
		const payload = updatePayload(message);
		expect(payload.system.activation.effects[0].discardedRoll).toEqual(serializedRoll());
		expect(payload.system.incomingReactions[0]).toMatchObject({ id: 'entry-1', used: true });
		expect(payload.system.rerolls).toEqual([
			expect.objectContaining({
				entryId: 'entry-1',
				itemUuid: 'Item.sand',
				label: 'Pocket Sand',
				actorUuid: 'Actor.target',
				usesLeft: null,
				woundsGained: 0,
			}),
		]);
		expect(payload.system.discardedCritTriggers).toBe(false);
	});

	it('throws the new roll with Dice So Nice before the card shows it', async () => {
		setupWorld();
		const message = createMessage();
		const showForRoll = vi.fn().mockResolvedValue(true);
		(globals().game as { dice3d?: unknown }).dice3d = { showForRoll };

		await message.resolveRerollReaction('entry-1', 'gm-user');

		delete (globals().game as { dice3d?: unknown }).dice3d;
		expect(showForRoll).toHaveBeenCalledTimes(1);
		expect(showForRoll.mock.calls[0][0]).toBeInstanceOf(DamageRoll);
		expect(showForRoll.mock.invocationCallOrder[0]).toBeLessThan(
			message.update.mock.invocationCallOrder[0],
		);
	});

	it('writes the card only after the dice land', async () => {
		setupWorld();
		const message = createMessage();
		let land = () => {};
		const showForRoll = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					land = resolve;
				}),
		);
		(globals().game as { dice3d?: unknown }).dice3d = { showForRoll };

		const rerolled = message.resolveRerollReaction('entry-1', 'gm-user');
		try {
			await vi.waitFor(() => expect(showForRoll).toHaveBeenCalled());
			expect(message.update).not.toHaveBeenCalled();
		} finally {
			land();
			await rerolled;
			delete (globals().game as { dice3d?: unknown }).dice3d;
		}

		expect(message.update).toHaveBeenCalledTimes(1);
	});

	describe('the rolling die while the dice roll', () => {
		function rollingMessage() {
			const message = createMessage();
			Object.defineProperty(message, 'id', { value: 'message-1' });
			const emit = vi.fn();
			(globals().game as { socket?: unknown }).socket = { emit };
			return { message, emit };
		}

		function diceSoNice(showForRoll: ReturnType<typeof vi.fn>) {
			(globals().game as { dice3d?: unknown }).dice3d = { showForRoll, isEnabled: () => true };
		}

		afterEach(() => {
			stopRerollRolling('message-1', false);
			delete (globals().game as { dice3d?: unknown }).dice3d;
			delete (globals().game as { socket?: unknown }).socket;
		});

		it('shows every client a die of the new roll in place of the damage roll', async () => {
			setupWorld();
			const { message, emit } = rollingMessage();
			let land = () => {};
			diceSoNice(
				vi.fn(
					() =>
						new Promise<void>((resolve) => {
							land = resolve;
						}),
				),
			);

			const rerolled = message.resolveRerollReaction('entry-1', 'gm-user');
			try {
				await vi.waitFor(() => expect(rollingRerollOf('message-1')).not.toBeNull());
				expect(rollingRerollOf('message-1')).toEqual({ slot: 'damage-node', faces: 6 });
				expect(emit).toHaveBeenCalledWith('system.nimble', {
					type: 'rerollRolling',
					messageId: 'message-1',
					roll: { slot: 'damage-node', faces: 6 },
				});
			} finally {
				land();
				await rerolled;
			}
		});

		it('stops the die on every client when the new roll cannot be written', async () => {
			setupWorld();
			const { message, emit } = rollingMessage();
			diceSoNice(vi.fn().mockResolvedValue(true));
			message.update.mockRejectedValueOnce(new Error('write failed'));
			const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

			await message.resolveRerollReaction('entry-1', 'gm-user');

			consoleError.mockRestore();
			expect(rollingRerollOf('message-1')).toBeNull();
			expect(emit).toHaveBeenLastCalledWith('system.nimble', {
				type: 'rerollRolling',
				messageId: 'message-1',
				roll: null,
			});
		});

		it('shows no die when Dice So Nice is off', async () => {
			setupWorld();
			const { message, emit } = rollingMessage();

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(emit).not.toHaveBeenCalled();
			expect(rollingRerollOf('message-1')).toBeNull();
		});
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

	it('refuses a waiting entry of a once per attack rule that was already used', async () => {
		const { target } = setupWorld({ oncePerAttack: true, rerollCost: { ...FREE, woundCost: 1 } });
		const message = createMessage({
			entries: [rerollEntry({ id: 'entry-0', used: true }), rerollEntry()],
		});

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

	it('starts a new list of rerolls on a button click', async () => {
		setupWorld();
		const message = createMessage();
		(message.system as Record<string, unknown>).rerolls = [
			{ entryId: 'earlier-action', itemUuid: 'Item.old' },
		];

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(updatePayload(message).system.rerolls).toEqual([
			expect.objectContaining({ entryId: 'entry-1' }),
		]);
	});

	it('puts the new roll in the rolls source and the card outcome follows it', async () => {
		setupWorld();
		const message = createMessage({ isCritical: true });

		await message.resolveRerollReaction('entry-1', 'gm-user');

		const payload = updatePayload(message) as ReturnType<typeof updatePayload> & {
			system: { isMiss: boolean };
		};
		expect(payload.rolls).toHaveLength(1);
		expect(JSON.parse(payload.rolls[0])).toMatchObject({
			originalFormula: '1d6 + 2',
			isCritical: false,
			isMiss: false,
		});
		expect(payload.system.activation.effects[0].roll).toMatchObject({
			originalFormula: '1d6 + 2',
		});
		expect(payload.system.isCritical).toBe(false);
		expect(payload.system.isMiss).toBe(false);
	});

	it('drops waiting offers the new outcome no longer allows, and keeps used ones', async () => {
		setupWorld();
		const spend = (id: string, outcomeTrigger: string, used = false) => ({
			...rerollEntry({ id, kind: 'spendPoolForDamage', side: null, itemUuid: '' }),
			actorUuid: 'Actor.attacker',
			outcomeTrigger,
			used,
		});
		const message = createMessage({
			isCritical: true,
			entries: [
				rerollEntry(),
				spend('spend-crit', 'criticalHit'),
				spend('spend-hit', 'hit'),
				spend('spend-crit-used', 'criticalHit', true),
			],
		});

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(updatePayload(message).system.incomingReactions.map((entry) => entry.id)).toEqual([
			'entry-1',
			'spend-hit',
			'spend-crit-used',
		]);
	});

	it('drops an open Movement Offer the new outcome no longer makes', async () => {
		setupWorld();
		const message = createMessage({ isCritical: true });
		const system = message.system as unknown as {
			activation: { effects: Array<Record<string, unknown>> };
			movementOffers?: unknown[];
		};
		system.activation.effects[0].on = {
			criticalHit: [
				{
					id: 'push',
					type: 'move',
					kind: 'forced',
					recipient: 'targets',
					distance: '2',
					distanceBySize: {},
					ignoreDifficultTerrain: false,
					direction: 'away',
				},
			],
		};
		system.movementOffers = [
			{
				id: 'push.victim',
				nodeId: 'push',
				tokenUuid: TARGET_TOKEN,
				name: 'Victim',
				kind: 'forced',
				spaces: 2,
				ignoreDifficultTerrain: true,
				state: 'open',
				usedBy: null,
				movedSpaces: null,
				stopped: false,
				conditional: false,
			},
		];

		await message.resolveRerollReaction('entry-1', 'gm-user');

		const payload = message.update.mock.calls[0][0] as { system: { movementOffers: unknown[] } };
		expect(payload.system.movementOffers).toEqual([]);
	});

	it('writes two entries used at the same time one after the other', async () => {
		setupWorld();
		const message = createMessage({ entries: [rerollEntry(), rerollEntry({ id: 'entry-2' })] });
		Object.defineProperty(message, 'id', { value: 'message-1' });
		message.update.mockImplementation(async (changes: Record<string, unknown>) => {
			const next = (changes.system as { incomingReactions?: unknown[] } | undefined)
				?.incomingReactions;
			if (next) Object.assign(message.system, { incomingReactions: next });
		});

		await Promise.all([
			message.resolveRerollReaction('entry-1', 'gm-user'),
			message.resolveRerollReaction('entry-2', 'gm-user'),
		]);

		expect(message.update).toHaveBeenCalledTimes(2);
		const entries = message.system.incomingReactions as Array<{ used: boolean }>;
		expect(entries.map((entry) => entry.used)).toEqual([true, true]);
	});

	it.each([
		['an unknown entry', () => ({ entryId: 'missing-entry' })],
		['an entry of another kind', () => ({ entries: [rerollEntry({ kind: 'redirectToSelf' })] })],
		['an unknown user', () => ({ userId: 'ghost-user' })],
		['a relayed request that claims GM identity', () => ({ viaSocket: true })],
		['a disabled rule', () => ({ ruleOverrides: { disabled: true } })],
	])('refuses %s', async (_name, scenario) => {
		const { entries, entryId, userId, viaSocket, ruleOverrides } = scenario() as {
			entries?: Array<Record<string, unknown>>;
			entryId?: string;
			userId?: string;
			viaSocket?: boolean;
			ruleOverrides?: Record<string, unknown>;
		};
		setupWorld(ruleOverrides);
		const message = createMessage({ entries });

		await message.resolveRerollReaction(
			entryId ?? 'entry-1',
			userId ?? 'gm-user',
			viaSocket ?? false,
		);

		expect(message.update).not.toHaveBeenCalled();
	});

	it('refuses when the card has no damage roll', async () => {
		setupWorld();
		const message = createMessage();
		(message.system.activation as { effects: unknown[] }).effects = [];

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.useFailed'),
		);
	});

	it('refuses a reroll of a picked die when no die was picked', async () => {
		setupWorld({ die: 'pickedDie' });
		const message = createMessage();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.rerollPickADie'),
		);
	});

	it('gives no dice to pick for a rule that rerolls the whole roll', () => {
		setupWorld();
		const message = createMessage();

		expect(message.rerollDiceToPick(rerollEntry() as never)).toBeNull();
	});

	describe('Modify Reroll rules of the reroll owner', () => {
		function modifier(config: Record<string, unknown>, itemName: string) {
			return {
				id: `${itemName}-rule`,
				type: 'modifyReroll',
				disabled: false,
				rerollIdentifier: 'inspiration',
				rollModeChange: 0,
				extraDamage: '',
				actionsForRoller: 0,
				tempHp: '',
				tempHpWithin: 0,
				appliesTo: () => true,
				item: { name: itemName, uuid: `Item.${itemName}` },
				...config,
			};
		}

		function withModifiers(world: World, ...modifiers: ReturnType<typeof modifier>[]) {
			const owner = Object.assign(world.target, {
				getRollData: () => ({ will: 3 }),
				items: { contents: modifiers.map((m) => ({ rules: new Map([[m.id, m]]) })) },
			});
			Object.assign(world.rule, { identifier: 'inspiration', actor: owner });
		}

		const advantage = () => modifier({ rollModeChange: 1 }, 'Unfailing Courage');

		const rollGlobal = globalThis as unknown as { Roll: { replaceFormulaData?: unknown } };
		let previousReplace: unknown;

		beforeEach(() => {
			previousReplace = rollGlobal.Roll.replaceFormulaData;
			rollGlobal.Roll.replaceFormulaData = (formula: string, data: Record<string, number>) =>
				formula.replace(/@(\w+)/g, (_match, key: string) => String(data[key] ?? 0));
		});

		afterEach(() => {
			rollGlobal.Roll.replaceFormulaData = previousReplace;
		});

		it('rolls the reroll with the advantage, and the card keeps that it was applied', async () => {
			const world = setupWorld();
			withModifiers(world, advantage());
			const message = createMessage();
			const evaluate = vi.spyOn(DamageRoll.prototype, 'evaluate');

			await message.resolveRerollReaction('entry-1', 'gm-user');

			const rolled = evaluate.mock.contexts[0] as DamageRoll;
			evaluate.mockRestore();
			expect((rolled.options as { rollModeSources?: number[] }).rollModeSources).toEqual([0, 1]);
			const change = {
				key: 'Item.Unfailing Courage#Unfailing Courage-rule:rollMode',
				kind: 'rollMode',
				label: 'Unfailing Courage',
				value: 1,
			};
			const system = updatePayload(message).system as Record<string, unknown>;
			expect(system.rollChanges).toEqual([change]);
			expect((system.rerolls as Array<Record<string, unknown>>)[0].changes).toEqual([change]);
		});

		const ballad = () => modifier({ extraDamage: '@will' }, 'Heroic Ballad');
		const balladChange = {
			key: 'Item.Heroic Ballad#Heroic Ballad-rule:extraDamage',
			kind: 'extraDamage',
			label: 'Heroic Ballad',
			value: 3,
		};

		function foldedBonuses(serialized: string | Record<string, unknown>) {
			const roll = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
			return ((roll.terms ?? []) as Array<{ number?: number; options?: { flavor?: string } }>)
				.filter((term) => term.options?.flavor === 'Heroic Ballad')
				.map((term) => term.number);
		}

		it('adds extra damage to the new roll as a bonus named by its feature', async () => {
			const world = setupWorld();
			withModifiers(world, ballad());
			const message = createMessage();

			await message.resolveRerollReaction('entry-1', 'gm-user');

			const payload = updatePayload(message);
			expect(foldedBonuses(payload.rolls[0])).toEqual([3]);
			expect(foldedBonuses(payload.system.activation.effects[0].roll as never)).toEqual([3]);
			expect((payload.system as Record<string, unknown>).rollChanges).toEqual([balladChange]);
		});

		it('carries extra damage the card applied onto a later reroll, once', async () => {
			const world = setupWorld();
			withModifiers(world, ballad());
			const message = createMessage();
			(message.system as Record<string, unknown>).rollChanges = [balladChange];

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(foldedBonuses(updatePayload(message).rolls[0])).toEqual([3]);
		});

		it.each(['old', 'new'] as const)(
			'adds the extra damage to the %s result when a player keeps it',
			async (choice) => {
				const world = setupWorld();
				withModifiers(world, ballad());
				const message = createMessage({ entries: [rerollEntry({ used: true })] });
				(message.system as Record<string, unknown>).pendingKeep = {
					entryId: 'entry-1',
					chooserUuid: 'Actor.target',
					roll: { ...serializedRoll(), total: 11 },
					reroll: {
						entryId: 'entry-1',
						itemUuid: 'Item.sand',
						ruleId: 'reroll-1',
						label: 'Pocket Sand',
						actorUuid: 'Actor.target',
						faces: 6,
						previous: { value: 4, outcome: null },
						next: { value: 6, outcome: null },
						usesLeft: null,
						woundsGained: 0,
						changes: [balladChange],
					},
					old: { total: 11, outcome: 'hit' },
					new: { total: 14, outcome: 'hit' },
					discardedCritTriggers: false,
				};

				await message.resolveKeepChoice(choice, 'gm-user');

				const payload = updatePayload(message);
				expect(foldedBonuses(payload.rolls[0])).toEqual([3]);
				expect((payload.system as Record<string, unknown>).rollChanges).toEqual([balladChange]);
			},
		);

		describe('what creatures gain at the click', () => {
			const presence = () => modifier({ tempHp: '@will', tempHpWithin: 0 }, 'Inspiring Presence');
			const bones = () => modifier({ actionsForRoller: 1 }, 'Fire in my Bones');

			type Combatant = {
				id: string;
				type: string;
				actor: unknown;
				system: { actions: { base: { current: number; max: number } } };
				update: ReturnType<typeof vi.fn>;
			};

			function placeOnScene(world: World, combat: 'started' | 'none' = 'started') {
				const tokens: Array<Record<string, unknown>> = [];
				const scene = { tokens };
				for (const [actor, x] of [
					[world.attacker, 0],
					[world.target, 1],
				] as const) {
					Object.assign(actor, { hasPlayerOwner: true, isOwner: true });
					const token = { uuid: `${actor.uuid}.Token`, x, disposition: 1, actor, parent: scene };
					tokens.push(token);
					Object.assign(actor, { getActiveTokens: () => [token] });
					foundry.utils.setProperty(actor, 'system.attributes.hp.temp', 0);
				}
				const combatant: Combatant = {
					id: 'kael-combatant',
					type: 'character',
					actor: world.attacker,
					system: { actions: { base: { current: 1, max: 3 } } },
					update: vi.fn(async () => undefined),
				};
				const all = [combatant];
				(globals().game as Record<string, unknown>).combat =
					combat === 'started'
						? {
								id: 'combat-1',
								started: true,
								combatants: {
									get: (id: string) => all.find((c) => c.id === id) ?? null,
									contents: all,
								},
								getCombatantsByActor: (actor: unknown) => all.filter((c) => c.actor === actor),
							}
						: null;
				return combatant;
			}

			let previousCombat: unknown;
			beforeEach(() => {
				previousCombat = (globals().game as Record<string, unknown>).combat;
			});
			afterEach(() => {
				(globals().game as Record<string, unknown>).combat = previousCombat;
			});

			it('gives temp HP to allies and an action to the one who rolled, and keeps the list', async () => {
				const world = setupWorld();
				withModifiers(world, presence(), bones());
				const combatant = placeOnScene(world);
				const message = createMessage();

				await message.resolveRerollReaction('entry-1', 'gm-user');

				expect(world.attacker.applyHealing).toHaveBeenCalledWith(3, 'tempHealing');
				expect(world.target.applyHealing).not.toHaveBeenCalled();
				expect(combatant.update).toHaveBeenCalledWith({ 'system.actions.base.current': 2 });
				const rerolls = (updatePayload(message).system as Record<string, unknown>).rerolls as Array<
					Record<string, unknown>
				>;
				expect(rerolls[0].grants).toEqual([
					{
						actorUuid: 'Actor.attacker',
						name: 'Kael',
						tempHp: { amount: 3, had: 0, keeps: null, source: 'Inspiring Presence' },
						actions: { amount: 1, reason: null, source: 'Fire in my Bones' },
						applied: true,
					},
				]);
			});

			it('gives no action out of combat, and says why', async () => {
				const world = setupWorld();
				withModifiers(world, bones());
				placeOnScene(world, 'none');
				const message = createMessage();

				await message.resolveRerollReaction('entry-1', 'gm-user');

				const rerolls = (updatePayload(message).system as Record<string, unknown>).rerolls as Array<
					Record<string, unknown>
				>;
				expect(rerolls[0].grants).toEqual([
					expect.objectContaining({
						actions: { amount: 0, reason: 'notInCombat', source: 'Fire in my Bones' },
					}),
				]);
			});

			it('applies nothing with Feature Effects off, and marks the list not applied', async () => {
				const world = setupWorld();
				withModifiers(world, presence(), bones());
				const combatant = placeOnScene(world);
				const settings = globals().game as unknown as { settings?: unknown };
				const previous = settings.settings;
				settings.settings = {
					get: (_scope: string, key: string) => key !== 'automation.applyRuleEffects',
				};
				const message = createMessage();

				try {
					await message.resolveRerollReaction('entry-1', 'gm-user');
				} finally {
					settings.settings = previous;
				}

				expect(world.attacker.applyHealing).not.toHaveBeenCalled();
				expect(combatant.update).not.toHaveBeenCalled();
				const rerolls = (updatePayload(message).system as Record<string, unknown>).rerolls as Array<
					Record<string, unknown>
				>;
				expect((rerolls[0].grants as Array<{ applied: boolean }>)[0].applied).toBe(false);
			});

			it('gives nothing when the reroll fails', async () => {
				const world = setupWorld();
				withModifiers(world, presence(), bones());
				const combatant = placeOnScene(world);
				const message = createMessage();
				message.update.mockRejectedValueOnce(new Error('write failed'));
				const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

				try {
					await message.resolveRerollReaction('entry-1', 'gm-user');
				} finally {
					error.mockRestore();
				}

				expect(world.attacker.applyHealing).not.toHaveBeenCalled();
				expect(combatant.update).not.toHaveBeenCalled();
			});
		});

		it('applies a roll change once per attack', async () => {
			const world = setupWorld();
			withModifiers(world, advantage());
			const message = createMessage();
			(message.system as Record<string, unknown>).rollChanges = [
				{
					key: 'Item.Unfailing Courage#Unfailing Courage-rule:rollMode',
					kind: 'rollMode',
					label: 'Unfailing Courage',
					value: 1,
				},
			];
			const evaluate = vi.spyOn(DamageRoll.prototype, 'evaluate');

			await message.resolveRerollReaction('entry-1', 'gm-user');

			const rolled = evaluate.mock.contexts[0] as DamageRoll;
			evaluate.mockRestore();
			expect((rolled.options as { rollModeSources?: number[] }).rollModeSources).toBeUndefined();
			const system = updatePayload(message).system as Record<string, unknown>;
			expect((system.rollChanges as unknown[]).length).toBe(1);
			expect((system.rerolls as Array<Record<string, unknown>>)[0].changes).toEqual([]);
		});
	});

	describe('a reroll whose result a player chooses', () => {
		function pending(overrides: Record<string, unknown> = {}) {
			return {
				entryId: 'entry-1',
				chooserUuid: 'Actor.target',
				roll: { ...serializedRoll(), total: 11 },
				reroll: {
					entryId: 'entry-1',
					itemUuid: 'Item.sand',
					ruleId: 'reroll-1',
					label: 'Pocket Sand',
					actorUuid: 'Actor.target',
					faces: 6,
					previous: { value: 4, outcome: null },
					next: { value: 6, outcome: null },
					usesLeft: null,
					woundsGained: 0,
				},
				old: { total: 8, outcome: 'hit' },
				new: { total: 11, outcome: 'hit' },
				discardedCritTriggers: false,
				...overrides,
			};
		}

		function waitingMessage() {
			const message = createMessage({ entries: [rerollEntry({ used: true })] });
			(message.system as Record<string, unknown>).pendingKeep = pending();
			return message;
		}

		it('pays and rolls, then waits with both results and leaves the old roll on the card', async () => {
			setupWorld({ keep: 'ownerChooses' });
			const message = createMessage();

			await message.resolveRerollReaction('entry-1', 'gm-user');

			const payload = updatePayload(message) as unknown as {
				rolls?: unknown;
				system: Record<string, unknown> & {
					incomingReactions: Array<Record<string, unknown>>;
					pendingKeep: Record<string, unknown>;
				};
			};
			expect(payload.rolls).toBeUndefined();
			expect(payload.system.rerolls).toBeUndefined();
			expect(payload.system.incomingReactions[0]).toMatchObject({ id: 'entry-1', used: true });
			expect(payload.system.pendingKeep).toMatchObject({
				entryId: 'entry-1',
				chooserUuid: 'Actor.target',
				old: { total: 8, outcome: 'hit' },
				new: { outcome: 'hit' },
				reroll: expect.objectContaining({ entryId: 'entry-1', label: 'Pocket Sand' }),
			});
		});

		it('lets the one who rolled choose for a rule that says so', async () => {
			setupWorld({ keep: 'rollerChooses' });
			const message = createMessage();

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(updatePayload(message).system).toMatchObject({
				pendingKeep: { chooserUuid: 'Actor.attacker' },
			});
		});

		it('keeps the old roll: only the history changes', async () => {
			setupWorld();
			const message = waitingMessage();

			await message.resolveKeepChoice('old', 'gm-user');

			expect(message.update).toHaveBeenCalledTimes(1);
			const payload = updatePayload(message);
			expect(payload.rolls).toBeUndefined();
			expect(payload.system).toMatchObject({
				rerolls: [expect.objectContaining({ entryId: 'entry-1', kept: 'old', keptTotal: 8 })],
				pendingKeep: null,
			});
		});

		it.each(['old', 'new'] as const)(
			'offers the feature again after the %s result is kept',
			async (choice) => {
				const { target, rule } = setupWorld();
				target.rules = [{ ...rule, item: { name: 'Pocket Sand', uuid: 'Item.sand' } }];
				const message = waitingMessage();

				await message.resolveKeepChoice(choice, 'gm-user');

				const entries = updatePayload(message).system.incomingReactions as Array<
					Record<string, unknown>
				>;
				expect(entries).toEqual([
					expect.objectContaining({ id: 'entry-1', used: true }),
					expect.objectContaining({ ruleId: 'reroll-1', used: false }),
				]);
			},
		);

		it('keeps the new roll: it goes on the card as a reroll does', async () => {
			setupWorld();
			const message = waitingMessage();

			await message.resolveKeepChoice('new', 'gm-user');

			const payload = updatePayload(message);
			expect(JSON.parse(payload.rolls[0])).toMatchObject({ total: 11 });
			expect(payload.system.rerolls).toEqual([
				expect.objectContaining({ entryId: 'entry-1', kept: 'new', keptTotal: 11 }),
			]);
			expect((payload.system as Record<string, unknown>).pendingKeep).toBeNull();
		});

		it('refuses a player who does not own the actor that chooses', async () => {
			const { target } = setupWorld();
			target.testUserPermission = vi.fn(() => false);
			const message = waitingMessage();

			await message.resolveKeepChoice('new', 'player-1', true);

			expect(message.update).not.toHaveBeenCalled();
		});

		it('holds Apply Damage and the other rerolls while it waits', () => {
			setupWorld();
			const message = waitingMessage();
			const other = rerollEntry({ id: 'entry-2' });
			(message.system.incomingReactions as unknown[]).push(other);

			expect(message.canStillUseReroll(other as never)).toBe(false);
			expect(message.canApplyAllDamage()).toBe(false);
			expect(message.canApplyDamage(5)).toBe(false);
		});

		it('refuses a second reroll that arrives while it waits', async () => {
			setupWorld();
			const message = waitingMessage();
			(message.system.incomingReactions as unknown[]).push(rerollEntry({ id: 'entry-2' }));

			await message.resolveRerollReaction('entry-2', 'gm-user');

			expect(message.update).not.toHaveBeenCalled();
			expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
				localize('NIMBLE.chat.incomingReactions.keepFirst'),
			);
		});
	});

	describe('an ally reroll the scan left out', () => {
		const leftOut = () =>
			rerollEntry({
				id: 'pip',
				side: 'ally',
				actorUuid: 'Actor.target',
				leftOut: { reason: 'disposition' },
			});

		it('the GM can add it', async () => {
			setupWorld();
			const message = createMessage({ entries: [rerollEntry(), leftOut()] });

			await message.addLeftOutReroll('pip');

			expect(updatePayload(message).system.incomingReactions).toEqual([
				expect.objectContaining({ id: 'entry-1' }),
				expect.objectContaining({ id: 'pip', leftOut: null }),
			]);
		});

		it('cannot be added by a player', async () => {
			setupWorld();
			globals().game.user = { isGM: false, id: 'player-1' };
			const message = createMessage({ entries: [leftOut()] });

			await message.addLeftOutReroll('pip');

			expect(message.update).not.toHaveBeenCalled();
		});
	});

	describe('an automatic reroll the new roll allows', () => {
		const WARD_ITEM = { name: 'Warding Bond', uuid: 'Item.ward' };

		/** The target rerolls every crit against it by itself. */
		function withAutomaticCritReroll(world: World) {
			const ward = rerollRule({
				id: 'ward-1',
				outcome: 'criticalHit',
				automatic: true,
				rerollsByItself: true,
				item: WARD_ITEM,
				actor: world.target,
			});
			world.target.rules = [ward];
			return ward;
		}

		/** Each evaluated DamageRoll reports the next outcome in the list. */
		function rollOutcomes(...crits: boolean[]) {
			const rolled = { count: 0 };
			// The shared Roll mock leaves `class` out, which marks the primary roll.
			const toJSON = vi
				.spyOn(Object.getPrototypeOf(DamageRoll.prototype), 'toJSON')
				.mockImplementation(function (this: DamageRoll) {
					return { class: 'DamageRoll', formula: this.formula, options: this.options, data: {} };
				});
			const spy = vi.spyOn(DamageRoll.prototype, 'evaluate').mockImplementation(async function (
				this: DamageRoll,
			) {
				Object.defineProperty(this, 'isCritical', { value: crits[rolled.count] ?? false });
				Object.defineProperty(this, 'isMiss', { value: false });
				rolled.count += 1;
				return this as never;
			});
			return {
				rolled,
				mockRestore: () => {
					spy.mockRestore();
					toJSON.mockRestore();
				},
			};
		}

		/** The card takes its own writes, so a later step reads them. */
		function writesApply(message: MockedMessage) {
			message.update.mockImplementation(async (changes: Record<string, unknown>) => {
				const { system, rolls, ...paths } = changes as {
					system?: Record<string, unknown>;
					rolls?: string[];
				};
				if (system) Object.assign(message.system, system);
				if (rolls) (message as unknown as { _source: { rolls: string[] } })._source.rolls = rolls;
				for (const [path, value] of Object.entries(paths)) {
					foundry.utils.setProperty(message, path, value);
				}
			});
		}

		function wardEntries(message: MockedMessage) {
			const entries = message.system.incomingReactions as Array<Record<string, unknown>>;
			return entries.filter((entry) => entry.ruleId === 'ward-1');
		}

		it("runs the target's rule once when a button reroll turns a hit into a crit", async () => {
			const world = setupWorld();
			withAutomaticCritReroll(world);
			const message = createMessage();
			writesApply(message);
			const evaluate = rollOutcomes(true, false);

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			expect(evaluate.rolled.count).toBe(2);
			expect(message.system.isCritical).toBe(false);
			expect(wardEntries(message)).toEqual([
				expect.objectContaining({ kind: 'reroll', side: 'target', used: true }),
			]);
			expect(message.system.rerolls).toEqual([
				expect.objectContaining({ itemUuid: 'Item.sand' }),
				expect.objectContaining({
					itemUuid: 'Item.ward',
					actorUuid: 'Actor.target',
					automatic: true,
				}),
			]);
			expect(
				(message.system.rerolls as Array<{ automatic?: boolean }>)[0].automatic,
			).toBeUndefined();
		});

		it('keeps the button reroll and its cost when it starts an automatic one', async () => {
			const world = setupWorld({ rerollCost: { ...FREE, woundCost: 1 } });
			withAutomaticCritReroll(world);
			const message = createMessage();
			(message.system as Record<string, unknown>).rerolls = [
				{ entryId: 'earlier-action', itemUuid: 'Item.old' },
			];
			writesApply(message);
			const evaluate = rollOutcomes(true, false);

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			expect(message.system.rerolls).toEqual([
				expect.objectContaining({
					entryId: 'entry-1',
					itemUuid: 'Item.sand',
					woundsGained: 1,
				}),
				expect.objectContaining({ itemUuid: 'Item.ward', woundsGained: 0 }),
			]);
		});

		it('does not run the same rule twice on a card', async () => {
			const world = setupWorld();
			withAutomaticCritReroll(world);
			const message = createMessage();
			writesApply(message);
			const evaluate = rollOutcomes(true, true, true);

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			expect(evaluate.rolled.count).toBe(2);
			expect(message.system.isCritical).toBe(true);
			expect(wardEntries(message)).toHaveLength(1);
		});

		it('shows the rule as a button while Feature Effects is off', async () => {
			const world = setupWorld();
			withAutomaticCritReroll(world);
			const settings = globals().game as unknown as {
				settings?: { get: (scope: string, key: string) => unknown };
			};
			const previousSettings = settings.settings;
			settings.settings = { get: (_scope, key) => key !== 'automation.applyRuleEffects' };
			const message = createMessage();
			writesApply(message);
			const evaluate = rollOutcomes(true, false);

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			settings.settings = previousSettings;
			expect(evaluate.rolled.count).toBe(1);
			expect(message.system.isCritical).toBe(true);
			expect(wardEntries(message)).toEqual([expect.objectContaining({ used: false })]);
		});

		it('leaves the charges as the final roll gives them', async () => {
			const world = setupWorld();
			withAutomaticCritReroll(world);
			const pool = { current: 1 };
			const recoveries = [{ trigger: 'onCriticalHit', mode: 'add', value: '1' }];
			const blade = {
				id: 'blade',
				name: 'Blade',
				actor: world.attacker,
				rules: new Map([
					[
						'0',
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'focus',
							scope: 'actor',
							max: '3',
							initial: 'max',
							recoveries,
						},
					],
				]),
				flags: {},
				update: vi.fn(async () => ({})),
			};
			Object.assign(world.attacker, {
				flags: {
					nimble: {
						chargePools: {
							'actor:focus': {
								id: 'actor:focus',
								identifier: 'focus',
								scope: 'actor',
								sourceItemId: 'blade',
								sourceItemName: 'Blade',
								label: 'Focus',
								current: pool.current,
								max: 3,
								seeded: true,
								recoveries,
							},
						},
					},
				},
				items: { contents: [blade], get: () => blade },
				getRollData: () => ({}),
				getDomain: () => new Set<string>(),
			});
			const lookup = globals().fromUuidSync.getMockImplementation() as (uuid: string) => unknown;
			globals().fromUuidSync = vi.fn((uuid: string) =>
				uuid === 'Item.blade' ? blade : lookup(uuid),
			);
			const message = createMessage({ flags: { itemUuid: 'Item.blade', chargeRecoveryGiven: [] } });
			writesApply(message);
			const evaluate = rollOutcomes(true, false);

			await message.resolveRerollReaction('entry-1', 'gm-user');

			evaluate.mockRestore();
			expect(
				foundry.utils.getProperty(world.attacker, 'flags.nimble.chargePools.actor:focus.current'),
			).toBe(1);
			expect(foundry.utils.getProperty(message, 'flags.nimble.chargeRecoveryGiven')).toEqual([]);
		});
	});

	describe('canStillUseReroll', () => {
		it('is true while every gate passes', () => {
			setupWorld();
			const message = createMessage();

			expect(message.canStillUseReroll(rerollEntry() as never)).toBe(true);
		});

		it('is false when the outcome no longer matches the rule', () => {
			setupWorld({ outcome: 'criticalHit' });
			const message = createMessage({ isCritical: false });

			expect(message.canStillUseReroll(rerollEntry() as never)).toBe(false);
		});

		it('is false when the rule no longer offers the reroll', () => {
			setupWorld({ offersRerollOn: vi.fn(() => false) });
			const message = createMessage();

			expect(message.canStillUseReroll(rerollEntry() as never)).toBe(false);
		});

		it('is false for a once per attack rule when the card has a used entry of it', () => {
			setupWorld({ oncePerAttack: true });
			const message = createMessage({
				entries: [rerollEntry({ id: 'entry-0', used: true }), rerollEntry()],
			});

			expect(message.canStillUseReroll(rerollEntry() as never)).toBe(false);
		});

		it('is false for a used entry and for a roll that misses by force', () => {
			setupWorld();

			expect(createMessage().canStillUseReroll(rerollEntry({ used: true }) as never)).toBe(false);
			expect(createMessage({ forceMiss: true }).canStillUseReroll(rerollEntry() as never)).toBe(
				false,
			);
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
				'flags.nimble.chargeConsumption': [
					{
						poolId: 'actor:focus',
						poolLabel: 'Blade',
						previousValue: 1,
						currentValue: 1,
						maxValue: 3,
						change: 0,
						recovery: { trigger: 'onCriticalHit', previousValue: 1, newValue: 2 },
					},
				],
			});
		});

		it('shows only the spend on the card when a crit is rerolled to a hit', async () => {
			const world = setupWorld();
			withCritPool(world, 1);
			const spend = {
				poolId: 'actor:focus',
				poolLabel: 'Blade',
				previousValue: 1,
				currentValue: 0,
				maxValue: 3,
				change: -1,
			};
			const message = createMessage({
				isCritical: true,
				flags: {
					...ATTACK_FLAGS,
					chargeConsumption: [
						{ ...spend, recovery: { trigger: 'onCriticalHit', previousValue: 0, newValue: 1 } },
					],
				},
			});

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(focus(world)).toBe(0);
			expect(message.update).toHaveBeenCalledTimes(2);
			expect(message.update.mock.calls[1][0]).toEqual({
				'flags.nimble.chargeRecoveryGiven': [],
				'flags.nimble.chargeConsumption': [spend],
			});
		});

		it('leaves the lines alone on a card made before the recovery record', async () => {
			const world = setupWorld();
			withCritPool(world, 1);
			const message = createMessage({
				isCritical: true,
				flags: {
					itemUuid: 'Item.blade',
					chargeConsumption: [
						{
							poolLabel: 'Blade',
							previousValue: 1,
							currentValue: 0,
							maxValue: 3,
							change: -1,
							recovery: { trigger: 'onCriticalHit', previousValue: 0, newValue: 1 },
						},
					],
				},
			});

			await message.resolveRerollReaction('entry-1', 'gm-user');

			expect(message.update.mock.calls[1][0]).toEqual({ 'flags.nimble.chargeRecoveryGiven': [] });
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
