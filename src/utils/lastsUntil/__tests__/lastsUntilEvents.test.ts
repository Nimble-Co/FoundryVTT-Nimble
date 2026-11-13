import { beforeEach, describe, expect, it, vi } from 'vitest';

const { effectsEndingAtMock, endEffectsMock } = vi.hoisted(() => ({
	effectsEndingAtMock: vi.fn((..._args: unknown[]): object[] => []),
	endEffectsMock: vi.fn(async (..._args: unknown[]) => undefined),
}));

vi.mock('../endEffects.js', () => ({
	effectsEndingAt: effectsEndingAtMock,
	endEffects: endEffectsMock,
}));

const { fireEvent, fireItemUseEvents, isAttackUse } = await import('../lastsUntilEvents.js');

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
	it('checks an attack, a spell cast and a use of the item again', () => {
		fireItemUseEvents(item({ type: 'spell' }, [{ type: 'damage' }]), []);

		expect(effectsEndingAtMock.mock.calls.map(([check]) => check)).toEqual([
			{ type: 'event', event: 'attack', actor: user },
			{ type: 'event', event: 'castSpell', actor: user },
			{ type: 'event', event: 'useAgain', actor: user, itemUuid: 'Actor.t.Item.i' },
		]);
	});

	it('an effect that two events end goes with the first only', () => {
		const effect = { id: 'e' };
		effectsEndingAtMock.mockReturnValue([effect]);

		fireItemUseEvents(item({ type: 'spell' }, [{ type: 'damage' }]), []);

		expect(endEffectsMock.mock.calls.map(([effects]) => effects)).toEqual([[effect], [], []]);
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
		expect(endEffectsMock).toHaveBeenCalledWith([effect], expect.any(String));
	});

	it('no creature, no event', () => {
		fireEvent('takeDamage', null);

		expect(effectsEndingAtMock).not.toHaveBeenCalled();
	});
});
