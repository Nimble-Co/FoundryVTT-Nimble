import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemHookName } from '#system';

const { endEffectsAtMock, endEffectsMock, fireEventMock, fireItemUseEventsMock } = vi.hoisted(
	() => ({
		endEffectsAtMock: vi.fn(async (..._args: unknown[]) => undefined),
		endEffectsMock: vi.fn(async (..._args: unknown[]) => undefined),
		fireEventMock: vi.fn((..._args: unknown[]) => undefined),
		fireItemUseEventsMock: vi.fn((..._args: unknown[]) => undefined),
	}),
);

vi.mock('../../utils/lastsUntil/endEffects.js', () => ({
	endEffects: endEffectsMock,
	endEffectsAt: endEffectsAtMock,
}));
vi.mock('../../utils/lastsUntil/lastsUntilEvents.js', () => ({
	eventHeading: (event: string, names: { name?: string | null }) => `${event}:${names.name}`,
	fireEvent: fireEventMock,
	fireItemUseEvents: fireItemUseEventsMock,
}));

type HookCallback = (...args: unknown[]) => unknown;

let hooks: Map<string, HookCallback>;
let user: { isActiveGM: boolean };

async function register() {
	hooks = new Map();
	(Hooks.on as unknown as ReturnType<typeof vi.fn>).mockImplementation(
		(event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		},
	);
	const { default: registerLastsUntilHooks } = await import('../lastsUntilHooks.js');
	registerLastsUntilHooks();
}

const hook = (name: string) => hooks.get(name) as HookCallback;

function makeCombat(id = 'combat1') {
	const combatants: Record<string, unknown>[] = [];
	const combat = { id, round: 2, turn: 0, turns: combatants, combatants: { contents: combatants } };
	const add = (cid: string, name: string, type = 'npc') => {
		const combatant = { id: cid, name, type, combat, actor: { type }, flags: {} };
		combatants.push(combatant);
		return combatant;
	};
	return { combat, add };
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	user = { isActiveGM: true };
	(globalThis as unknown as { game: Record<string, unknown> }).game.user = user;
	await register();
});

describe('turn and round moments', () => {
	it('a turn end checks the turn of that combatant, with the round of the turn', () => {
		const { combat, add } = makeCombat();
		const goblin = add('cGoblin', 'Goblin');

		hook('nimbleCombatTurnEnd')(goblin, { round: 1 });

		expect(endEffectsAtMock).toHaveBeenCalledWith(
			{
				type: 'turnEnd',
				combatId: 'combat1',
				seat: { combatantId: 'cGoblin', groupId: null, isHero: false },
				round: 1,
				turn: null,
			},
			{
				key: 'combat1:1:cGoblin:turnEnd',
				heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnEnd', data: { name: 'Goblin' } },
			},
			combat,
		);
	});

	it('a turn end with no round reads it from the turn order', () => {
		const { add } = makeCombat();
		add('cTessa', 'Tessa', 'character');
		const goblin = add('cGoblin', 'Goblin');

		hook('nimbleCombatTurnEnd')(goblin);

		expect(endEffectsAtMock.mock.calls[0][0]).toMatchObject({ round: 1 });
	});

	it('a turn end ends the effects of that combatant that had an inactive round', () => {
		const { combat, add } = makeCombat();
		const goblin = add('cGoblin', 'Goblin');
		const idle = {
			active: true,
			start: { combat: 'combat1', round: 1 },
			lastsUntil: [{ kind: 'event', event: 'inactiveRound', who: 'holder' }],
			getFlag: () => undefined,
		};
		const plain = { active: true, start: { combat: 'combat1', round: 1 }, lastsUntil: [] };
		(goblin.actor as { effects?: unknown[] }).effects = [idle, plain];

		hook('nimbleCombatTurnEnd')(goblin, { round: 2 });

		// The same card as the other ends of that turn, with the reason on the line.
		expect(endEffectsMock).toHaveBeenCalledWith([idle], {
			key: 'combat1:2:cGoblin:turnEnd',
			heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnEnd', data: { name: 'Goblin' } },
			reason: 'inactiveRound:Goblin',
		});
		expect(endEffectsAtMock.mock.calls[0][1]).toMatchObject({ key: 'combat1:2:cGoblin:turnEnd' });
		expect(endEffectsAtMock.mock.calls[0][2]).toBe(combat);
	});

	it('a turn start ends no effect for an inactive round', () => {
		const { add } = makeCombat();
		const goblin = add('cGoblin', 'Goblin');
		(goblin.actor as { effects?: unknown[] }).effects = [
			{
				active: true,
				start: { combat: 'combat1', round: 1 },
				lastsUntil: [{ kind: 'event', event: 'inactiveRound', who: 'holder' }],
				getFlag: () => undefined,
			},
		];

		hook('nimbleCombatTurnStart')(goblin, { round: 2 });

		expect(endEffectsMock).not.toHaveBeenCalled();
	});

	it('a turn start of a hero marks the seat as a hero', () => {
		const { add } = makeCombat();
		const tessa = add('cTessa', 'Tessa', 'character');

		hook('nimbleCombatTurnStart')(tessa, { round: 2 });

		expect(endEffectsAtMock.mock.calls[0][0]).toMatchObject({
			type: 'turnStart',
			seat: { isHero: true },
			round: 2,
		});
	});

	it('a turn end gives the place of the turn, for a solo monster with more than one', () => {
		const { add } = makeCombat();

		hook('nimbleCombatTurnEnd')(add('cDragon', 'Dragon'), { round: 1, turn: 2 });

		expect(endEffectsAtMock.mock.calls[0][0]).toMatchObject({ round: 1, turn: 2 });
	});

	it('a round start checks that round', () => {
		const { combat } = makeCombat();

		hook('nimbleCombatRoundStart')(combat, { round: 2 });

		expect(endEffectsAtMock.mock.calls[0][0]).toEqual({
			type: 'roundStart',
			combatId: 'combat1',
			round: 2,
		});
	});

	it('a round end checks that round', () => {
		const { combat } = makeCombat();

		hook('nimbleCombatRoundEnd')(combat, { round: 3 });

		expect(endEffectsAtMock).toHaveBeenCalledWith(
			{ type: 'roundEnd', combatId: 'combat1', round: 3 },
			{
				key: 'combat1:3::roundEnd',
				heading: { key: 'NIMBLE.lastsUntil.chat.heading.roundEnd', data: { round: 3 } },
			},
			combat,
		);
	});

	it('only the active GM checks them', () => {
		user.isActiveGM = false;
		const { combat, add } = makeCombat();

		hook('nimbleCombatTurnEnd')(add('cGoblin', 'Goblin'), { round: 1 });
		hook('nimbleCombatRoundStart')(combat, { round: 3 });

		expect(endEffectsAtMock).not.toHaveBeenCalled();
	});
});

describe('combat end', () => {
	it('ends once when the combat stops and is then deleted', () => {
		const { combat } = makeCombat();

		hook('updateCombat')(combat, { started: false });
		hook('deleteCombat')(combat);

		expect(endEffectsAtMock).toHaveBeenCalledTimes(1);
		expect(endEffectsAtMock.mock.calls[0][0]).toEqual({ type: 'combatEnd', combatId: 'combat1' });
		expect(endEffectsAtMock.mock.calls[0][1]).toMatchObject({ key: 'combatEnd:combat1' });
	});

	it('checks core durations as combat starts, and a restarted combat can end again', () => {
		const { combat } = makeCombat('combat3');

		hook('updateCombat')(combat, { started: false });
		hook('updateCombat')(combat, { started: true });
		hook('updateCombat')(combat, { started: false });

		expect(endEffectsAtMock.mock.calls.map(([check]) => (check as { type: string }).type)).toEqual([
			'combatEnd',
			'combatStart',
			'combatEnd',
		]);
	});

	it('ends when a running combat is deleted', () => {
		const { combat } = makeCombat('combat2');

		hook('deleteCombat')(combat);

		expect(endEffectsAtMock).toHaveBeenCalledTimes(1);
	});
});

describe('world time', () => {
	it('checks time moments when time moves on, not back', () => {
		hook('updateWorldTime')(600, 60);
		hook('updateWorldTime')(540, -60);

		expect(endEffectsAtMock).toHaveBeenCalledTimes(1);
		expect(endEffectsAtMock.mock.calls[0][0]).toEqual({ type: 'worldTime', worldTime: 600 });
		expect(endEffectsAtMock.mock.calls[0][1]).toMatchObject({ key: 'time:600' });
	});
});

describe('events', () => {
	const actorAt = (hp: number, wounds?: { value: number; max: number }) => ({
		name: 'Goblin',
		type: 'npc',
		system: { attributes: { hp: { value: hp, max: 10 }, ...(wounds ? { wounds } : {}) } },
	});

	const utils = foundry.utils as unknown as Record<string, unknown>;
	let hadHasProperty: unknown;

	beforeEach(() => {
		hadHasProperty = utils.hasProperty;
		utils.hasProperty ??= (object: object, path: string) =>
			foundry.utils.getProperty(object, path) !== undefined;
	});

	let speakerSpy: { mockRestore(): void } | null = null;

	/** ChatMessage.getSpeakerActor gives `actor`; afterEach restores it. */
	function speakerActorIs(actor: unknown) {
		speakerSpy = vi.spyOn(ChatMessage, 'getSpeakerActor').mockReturnValue(actor as never);
	}

	afterEach(() => {
		utils.hasProperty = hadHasProperty;
		speakerSpy?.mockRestore();
		speakerSpy = null;
	});

	it('dropping to 0 HP with no wound track is 0 HP and death', () => {
		const actor = actorAt(0);

		hook('updateActor')(actor, { system: { attributes: { hp: { value: 0 } } } }, {});

		expect(fireEventMock.mock.calls.map(([event]) => event)).toEqual(['zeroHp', 'die']);
	});

	it('dropping to 0 HP with wounds left is 0 HP, not death', () => {
		const actor = actorAt(0, { value: 1, max: 6 });

		hook('updateActor')(actor, { system: { attributes: { hp: { value: 0 } } } }, {});

		expect(fireEventMock.mock.calls.map(([event]) => event)).toEqual(['zeroHp']);
	});

	it('HP that goes up is a heal', () => {
		const actor = actorAt(9);
		const options = { nimble: { previousHp: { value: 4, max: 10, temp: 0 } } };

		hook('updateActor')(actor, { system: { attributes: { hp: { value: 9 } } } }, options);

		expect(fireEventMock).toHaveBeenCalledWith('healed', actor);
	});

	it('a rest is a rest of that creature', () => {
		const actor = { name: 'Tessa' };

		hook(systemHookName('rest'))({ actor, restType: 'safe' });

		expect(fireEventMock).toHaveBeenCalledWith('rest', actor);
	});

	it('the events every client sees are checked only on the active GM', () => {
		user.isActiveGM = false;

		hook('updateToken')({ actor: {} }, { x: 1 });
		hook('deleteActiveEffect')({
			parent: Object.create(Actor.prototype),
			name: 'Rage',
			statuses: new Set(),
		});

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('a condition that a new application replaces does not end', () => {
		const effect = { parent: Object.create(Actor.prototype), name: 'Taunted', statuses: new Set() };

		hook('deleteActiveEffect')(effect, { nimbleConditionReplaced: true });

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('a move of the token is a move of its actor', () => {
		const actor = { name: 'Goblin' };

		hook('updateToken')({ actor }, { x: 100 });
		hook('updateToken')({ actor }, { hidden: true });

		expect(fireEventMock).toHaveBeenCalledTimes(1);
		expect(fireEventMock).toHaveBeenCalledWith('move', actor);
	});

	it('an effect that ends on an actor is an event, and Concentrating going away is another', () => {
		const holder = Object.create(Actor.prototype);
		const effect = { parent: holder, name: 'Rage', statuses: new Set(['concentration']) };

		hook('deleteActiveEffect')(effect);

		expect(fireEventMock).toHaveBeenCalledWith('effectEnds', holder, {
			effectName: 'Rage',
			effect: 'Rage',
		});
		expect(fireEventMock).toHaveBeenCalledWith('loseConcentration', holder);
	});

	it('the user who deletes an effect takes back the temp HP that it gave', () => {
		const holder = Object.assign(Object.create(Actor.prototype), {
			system: { attributes: { hp: { temp: 9 } } },
			update: vi.fn(async () => undefined),
		});
		const effect = {
			parent: holder,
			name: 'Frost Shield',
			statuses: new Set(),
			system: { tempHp: 6 },
		};

		hook('deleteActiveEffect')(effect, {}, game.user?.id);
		hook('deleteActiveEffect')(effect, {}, 'someone else');
		hook('deleteActiveEffect')(effect, { nimbleConditionReplaced: true }, game.user?.id);

		expect(holder.update, 'a replaced copy leaves its temp HP').toHaveBeenCalledTimes(1);
		expect(holder.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 3 });
	});

	it('an item use hands the targets to the item use events', () => {
		const item = { actor: {} };
		const target = { name: 'Ogre' };

		hook(systemHookName('useItem'))(item, null, { targets: [{ actor: target }, null] });

		expect(fireItemUseEventsMock).toHaveBeenCalledWith(item, [target], null);
	});

	it('an item use hands its card to the item use events, as the host of the lines', () => {
		const item = { actor: { name: 'Tessa' } };
		const card = { id: 'card1' };

		hook(systemHookName('useItem'))(item, card, { targets: [] });

		expect(fireItemUseEventsMock).toHaveBeenCalledWith(item, [], card);
	});

	it('an item use with no card hands on where its lines went, so its ends go there too', () => {
		const item = { actor: { name: 'Tessa' } };
		const eventHost = {
			moment: { key: 'once:abc', heading: { key: 'NIMBLE.chat.events.useHeading' } },
			whisper: [],
		};

		hook(systemHookName('useItem'))(item, null, { targets: [], eventHost });

		expect(fireItemUseEventsMock).toHaveBeenCalledWith(item, [], eventHost);
	});

	it('damage on a miss is no damage', () => {
		hook(systemHookName('damageApplied'))({ targetActor: { name: 'Ogre' }, isMiss: true });

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('damage is damage taken by the target', () => {
		const target = { name: 'Ogre' };

		hook(systemHookName('damageApplied'))({ targetActor: target, sourceActor: null });

		expect(fireEventMock).toHaveBeenCalledWith('takeDamage', target, {}, null);
	});

	it('damage applied from a card has that card as the host of both events', () => {
		const target = { name: 'Ogre' };
		const sourceActor = { name: 'Tessa' };
		const card = { id: 'card1' };

		hook(systemHookName('damageApplied'))({ targetActor: target, sourceActor, card });

		expect(fireEventMock.mock.calls).toEqual([
			['takeDamage', target, {}, card],
			['nextDamage', sourceActor, {}, card],
		]);
	});

	it('damage is the next damage of the speaker actor of the card', () => {
		const speakerActor = { name: 'Tessa' };
		const sourceActor = { name: 'Other' };
		const speaker = { actor: 'tessa' };
		speakerActorIs(speakerActor);

		const card = { speaker };
		hook(systemHookName('damageApplied'))({ targetActor: { name: 'Ogre' }, sourceActor, card });

		expect(fireEventMock).toHaveBeenCalledWith('nextDamage', speakerActor, {}, card);
	});

	it('damage is the next damage of the source actor when the card has no speaker actor', () => {
		const sourceActor = { name: 'Tessa' };
		speakerActorIs(null);

		const card = { speaker: { actor: 'gone' } };
		hook(systemHookName('damageApplied'))({ targetActor: { name: 'Ogre' }, sourceActor, card });

		expect(fireEventMock).toHaveBeenCalledWith('nextDamage', sourceActor, {}, card);
	});

	it('damage with no card is the next damage of the source actor', () => {
		const sourceActor = { name: 'Tessa' };

		hook(systemHookName('damageApplied'))({ targetActor: { name: 'Ogre' }, sourceActor });

		expect(fireEventMock).toHaveBeenCalledWith('nextDamage', sourceActor, {}, null);
	});

	it('damage on a miss is not the next damage', () => {
		hook(systemHookName('damageApplied'))({
			targetActor: { name: 'Ogre' },
			sourceActor: { name: 'Tessa' },
			isMiss: true,
		});

		expect(fireEventMock.mock.calls.map(([event]) => event)).not.toContain('nextDamage');
	});

	it.each(['savingThrow', 'abilityCheck', 'skillCheck'])(
		'a %s card of this user is the next roll of its speaker actor',
		(type) => {
			const actor = { name: 'Tessa' };
			Object.assign(user, { id: 'me' });
			speakerActorIs(actor);

			const card = { id: 'roll1', type, speaker: { actor: 'tessa' } };
			hook('createChatMessage')(card, {}, 'me');

			expect(fireEventMock).toHaveBeenCalledWith('nextRoll', actor, {}, card);
		},
	);

	it('a save card of another user is not the next roll here', () => {
		Object.assign(user, { id: 'me' });
		speakerActorIs({ name: 'Tessa' });

		hook('createChatMessage')({ type: 'savingThrow', speaker: { actor: 'tessa' } }, {}, 'other');

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('a card of another type is not the next roll', () => {
		Object.assign(user, { id: 'me' });
		speakerActorIs({ name: 'Tessa' });

		hook('createChatMessage')({ type: 'feature', speaker: { actor: 'tessa' } }, {}, 'me');

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('a charge pool that goes up is a charge gained', () => {
		const actor = { name: 'Hunter' };

		hook(systemHookName('chargePool.changed'))({ actor, previousValue: 0, newValue: 1 });
		hook(systemHookName('chargePool.changed'))({ actor, previousValue: 1, newValue: 0 });

		expect(fireEventMock).toHaveBeenCalledTimes(1);
		expect(fireEventMock).toHaveBeenCalledWith('chargeGained', actor);
	});
});
