import { beforeEach, describe, expect, it, vi } from 'vitest';

const effectsEndingAtMock = vi.fn((..._args: unknown[]): object[] => []);
const endEffectsMock = vi.fn(async (..._args: unknown[]) => undefined);
const noteActivityMock = vi.fn(async (..._args: unknown[]): Promise<void> => {});

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
vi.resetModules();
vi.doMock('../endEffects.js', () => ({
	effectsEndingAt: effectsEndingAtMock,
	endEffects: endEffectsMock,
}));
vi.doMock('../inactiveRound.js', () => ({ noteActivity: noteActivityMock }));

const { fireAttackEvents, fireEvent, fireItemUseEvents, isAttackUse } = await import(
	'../lastsUntilEvents.js'
);

const user = { name: 'Tessa' };
const ally = { name: 'Bruno' };

function item(fields: Record<string, unknown> = {}, effects: object[] = []) {
	return {
		uuid: 'Actor.t.Item.i',
		name: 'Fire Bolt',
		type: 'feature',
		actor: user,
		system: { activation: { effects } },
		...fields,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	effectsEndingAtMock.mockReturnValue([]);
});

describe('isAttackUse', () => {
	it('an activation with a damage roll is an attack', () => {
		expect(isAttackUse(item({}, [{ type: 'damage' }]), [])).toBe(true);
	});

	it('an attack type with no damage roll is not an attack', () => {
		const touch = item({
			system: {
				activation: { effects: [{ type: 'condition' }], targets: { attackType: 'melee' } },
			},
		});
		expect(isAttackUse(touch, [ally])).toBe(false);
	});

	it('a save with no target chosen is an attack', () => {
		expect(isAttackUse(item({}, [{ type: 'savingThrow' }]), [])).toBe(true);
	});

	it('a save asked of another creature is an attack; one asked only of the user is not', () => {
		const save = item({}, [{ type: 'savingThrow' }]);

		expect(isAttackUse(save, [ally])).toBe(true);
		expect(isAttackUse(save, [user])).toBe(false);
	});

	it('healing is not an attack', () => {
		expect(isAttackUse(item({}, [{ type: 'healing' }]), [ally])).toBe(false);
	});
});

describe('fireItemUseEvents', () => {
	it('checks an attack, a roll, a spell cast and a use of the item again', () => {
		fireItemUseEvents(item({ type: 'spell' }, [{ type: 'damage' }]), []);

		expect(effectsEndingAtMock.mock.calls.map(([check]) => check)).toEqual([
			{ type: 'event', event: 'attack', actor: user },
			{ type: 'event', event: 'nextRoll', actor: user },
			{ type: 'event', event: 'castSpell', actor: user },
			{ type: 'event', event: 'useAgain', actor: user, itemUuid: 'Actor.t.Item.i' },
		]);
	});

	it('an effect that two events end goes with the first only', () => {
		const effect = { id: 'e' };
		effectsEndingAtMock.mockReturnValue([effect]);

		fireItemUseEvents(item({ type: 'spell' }, [{ type: 'damage' }]), []);

		expect(endEffectsMock.mock.calls.map(([effects]) => effects)).toEqual([[effect], [], [], []]);
	});
});

function firedEvents(): unknown[] {
	return effectsEndingAtMock.mock.calls.map(([check]) => (check as { event: string }).event);
}

describe('fireItemUseEvents with an item card', () => {
	it('every event of the use has the item card as its host', () => {
		fireItemUseEvents(item({ type: 'spell' }, [{ type: 'damage' }]), [], { id: 'itemCard' });

		const hosts = endEffectsMock.mock.calls.map(
			([, moment]) => (moment as { hostId?: string }).hostId,
		);
		expect(hosts).toEqual(['itemCard', 'itemCard', 'itemCard', 'itemCard']);
	});

	it('a use with no card (a rule hid it) has no host', () => {
		fireItemUseEvents(item({}, [{ type: 'damage' }]), [], null);

		expect(endEffectsMock.mock.calls.every(([, moment]) => !('hostId' in (moment as object)))).toBe(
			true,
		);
	});
});

describe('fireItemUseEvents for a roll and a spell', () => {
	it('an attack also checks the next roll', () => {
		fireItemUseEvents(item({}, [{ type: 'damage' }]), []);

		expect(firedEvents()).toEqual(['attack', 'nextRoll', 'useAgain']);
	});

	it('a use that is not an attack does not check the next roll', () => {
		fireItemUseEvents(item({}, [{ type: 'healing' }]), [ally]);

		expect(firedEvents()).not.toContain('nextRoll');
	});

	it('a spell of tier 1 or more checks the next spell', () => {
		fireItemUseEvents(
			item({ type: 'spell', system: { tier: 1, activation: { effects: [] } } }),
			[],
		);

		expect(firedEvents()).toEqual(['castSpell', 'nextSpell', 'useAgain']);
	});

	it('a cantrip of tier 0 does not check the next spell', () => {
		fireItemUseEvents(
			item({ type: 'spell', system: { tier: 0, activation: { effects: [] } } }),
			[],
		);

		expect(firedEvents()).not.toContain('nextSpell');
	});

	it('a feature does not check the next spell', () => {
		fireItemUseEvents(item({ system: { tier: 2, activation: { effects: [] } } }), []);

		expect(firedEvents()).not.toContain('nextSpell');
	});
});

describe('fireEvent', () => {
	it('ends what the event ends, with a heading that names the creature', () => {
		const effect = { id: 'e' };
		effectsEndingAtMock.mockReturnValue([effect]);

		fireEvent('takeDamage', user);

		expect(effectsEndingAtMock).toHaveBeenCalledWith({
			type: 'event',
			event: 'takeDamage',
			actor: user,
		});
		expect(endEffectsMock).toHaveBeenCalledWith(
			[effect],
			{
				heading: {
					key: 'NIMBLE.lastsUntil.chat.heading.takeDamage',
					data: { name: user.name, item: '', effect: '' },
				},
			},
			{ check: { type: 'event', event: 'takeDamage', actor: user } },
		);
	});

	it('with a host card, the ends go on that card', () => {
		effectsEndingAtMock.mockReturnValue([{ id: 'e' }]);

		fireEvent('takeDamage', user, {}, { id: 'card1' });

		expect(endEffectsMock.mock.calls[0][1]).toMatchObject({ hostId: 'card1' });
	});

	it('a host with no id is no host', () => {
		effectsEndingAtMock.mockReturnValue([{ id: 'e' }]);

		fireEvent('takeDamage', user, {}, { id: null });

		expect(endEffectsMock.mock.calls[0][1]).not.toHaveProperty('hostId');
	});

	it('no creature, no event', () => {
		fireEvent('takeDamage', null);

		expect(effectsEndingAtMock).not.toHaveBeenCalled();
	});
});

describe('fireAttackEvents', () => {
	it('an attack that is not an item use checks the attack and the next roll', () => {
		fireAttackEvents(user);

		expect(firedEvents()).toEqual(['attack', 'nextRoll']);
	});

	it('the attack card is the host of the ends of both events', () => {
		effectsEndingAtMock.mockReturnValueOnce([{ id: 'a' }]).mockReturnValueOnce([{ id: 'b' }]);

		fireAttackEvents(user, { id: 'attack1' });

		expect(endEffectsMock.mock.calls.map(([, moment]) => moment)).toEqual([
			expect.objectContaining({ hostId: 'attack1' }),
			expect.objectContaining({ hostId: 'attack1' }),
		]);
	});

	it('no creature, no event', () => {
		fireAttackEvents(null);

		expect(effectsEndingAtMock).not.toHaveBeenCalled();
	});
});

describe('activity for an inactive round', () => {
	it('an attack that is not an item use is activity of the attacker', () => {
		fireAttackEvents(user);

		expect(noteActivityMock).toHaveBeenCalledWith(user, { attack: true });
	});

	it('an item use is activity: an attack for every effect, a use for the effects of that item', () => {
		fireItemUseEvents(item({}, [{ type: 'damage' }]), [ally]);
		fireItemUseEvents(item(), []);

		expect(noteActivityMock.mock.calls).toEqual([
			[user, { attack: true, itemUuid: 'Actor.t.Item.i' }],
			[user, { attack: false, itemUuid: 'Actor.t.Item.i' }],
		]);
	});

	it('the events resolve when the activity is saved', async () => {
		const noted = Promise.resolve();
		noteActivityMock.mockReturnValueOnce(noted).mockReturnValueOnce(noted);

		expect(fireAttackEvents(user)).toBe(noted);
		expect(fireItemUseEvents(item(), [])).toBe(noted);
		await expect(fireAttackEvents(null)).resolves.toBeUndefined();
	});
});
