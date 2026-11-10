import { beforeEach, describe, expect, it, vi } from 'vitest';

const { endEffectsAtMock, fireEventMock, fireItemUseEventsMock } = vi.hoisted(() => ({
	endEffectsAtMock: vi.fn(async (..._args: unknown[]) => undefined),
	fireEventMock: vi.fn((..._args: unknown[]) => undefined),
	fireItemUseEventsMock: vi.fn((..._args: unknown[]) => undefined),
}));

vi.mock('../../utils/lastsUntil/endEffects.js', () => ({ endEffectsAt: endEffectsAtMock }));
vi.mock('../../utils/lastsUntil/lastsUntilEvents.js', () => ({
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
			},
			expect.any(String),
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

	it('a round end checks that round', () => {
		const { combat } = makeCombat();

		hook('nimbleCombatRoundEnd')(combat, { round: 3 });

		expect(endEffectsAtMock).toHaveBeenCalledWith(
			{ type: 'roundEnd', combatId: 'combat1', round: 3 },
			expect.any(String),
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
	});
});

describe('events', () => {
	const actorAt = (hp: number, wounds?: { value: number; max: number }) => ({
		name: 'Goblin',
		type: 'npc',
		system: { attributes: { hp: { value: hp, max: 10 }, ...(wounds ? { wounds } : {}) } },
	});

	it('dropping to 0 HP with no wound track is 0 HP and death', () => {
		const utils = foundry.utils as unknown as Record<string, unknown>;
		utils.hasProperty ??= (object: object, path: string) =>
			foundry.utils.getProperty(object, path) !== undefined;
		const actor = actorAt(0);

		hook('updateActor')(actor, { system: { attributes: { hp: { value: 0 } } } }, {});

		expect(fireEventMock.mock.calls.map(([event]) => event)).toEqual(['zeroHp', 'die']);
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

	it('an item use hands the targets to the item use events', () => {
		const item = { actor: {} };
		const target = { name: 'Ogre' };

		hook('nimble.useItem')(item, null, { targets: [{ actor: target }, null] });

		expect(fireItemUseEventsMock).toHaveBeenCalledWith(item, [target]);
	});

	it('damage on a miss is no damage', () => {
		hook('nimble.damageApplied')({ targetActor: { name: 'Ogre' }, isMiss: true });

		expect(fireEventMock).not.toHaveBeenCalled();
	});

	it('a charge pool that goes up is a charge gained', () => {
		const actor = { name: 'Hunter' };

		hook('nimble.chargePool.changed')({ actor, previousValue: 0, newValue: 1 });
		hook('nimble.chargePool.changed')({ actor, previousValue: 1, newValue: 0 });

		expect(fireEventMock).toHaveBeenCalledTimes(1);
		expect(fireEventMock).toHaveBeenCalledWith('chargeGained', actor);
	});
});
