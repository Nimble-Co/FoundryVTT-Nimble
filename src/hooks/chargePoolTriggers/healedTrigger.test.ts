import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';

const { applyRecovery } = vi.hoisted(() => ({ applyRecovery: vi.fn() }));

vi.mock('../../utils/chargePool/chargePoolRecover.js', () => ({
	applyRecoveryToActorIfEligible: applyRecovery,
}));

type HealedHook = (actor: unknown, changes: unknown, options: unknown, userId: string) => void;

function globals() {
	return getTestGlobals<{ game: { user: { id: string } | null }; Hooks: { on: unknown } }>();
}

function actor(type: string, hp: number) {
	return { id: 'actor-1', type, system: { attributes: { hp: { value: hp, max: 20, temp: 0 } } } };
}

function recordedHp(hp: number) {
	return { nimble: { previousHp: { value: hp, max: 20, temp: 0 } } };
}

/** A level up update: max HP rose to 20 in an earlier update, and `following` HP follows it. */
function levelUp(hp: number, following: number) {
	return { nimble: { previousHp: { value: hp, max: 20, temp: 0 }, hpFollowingMax: following } };
}

async function registeredHook(): Promise<HealedHook> {
	const callbacks = createHookCapture(globals().Hooks.on as never);
	const { registerHealedTriggerHooks } = await import('./healedTrigger.js');
	registerHealedTriggerHooks();
	return callbacks.get('updateActor') as HealedHook;
}

describe('registerHealedTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		applyRecovery.mockClear();
		globals().game.user = { id: 'user-1' };
	});

	it('applies the healed trigger when HP went up', async () => {
		const hook = await registeredHook();
		const healedActor = actor('character', 15);

		hook(healedActor, {}, recordedHp(10), 'user-1');

		expect(applyRecovery).toHaveBeenCalledTimes(1);
		expect(applyRecovery).toHaveBeenCalledWith(healedActor, 'onHealed');
	});

	it('does nothing for the HP a level up adds', async () => {
		const hook = await registeredHook();

		hook(actor('character', 15), {}, levelUp(10, 5), 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('applies the healed trigger when an update heals more than the level up adds', async () => {
		const hook = await registeredHook();
		const healedActor = actor('character', 20);

		hook(healedActor, {}, levelUp(10, 5), 'user-1');

		expect(applyRecovery).toHaveBeenCalledWith(healedActor, 'onHealed');
	});

	it('does nothing when HP did not go up', async () => {
		const hook = await registeredHook();

		hook(actor('character', 10), {}, recordedHp(10), 'user-1');
		hook(actor('character', 5), {}, recordedHp(10), 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('does nothing when the update did not record HP', async () => {
		const hook = await registeredHook();

		hook(actor('character', 15), {}, {}, 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('only applies on the client of the user who made the update', async () => {
		const hook = await registeredHook();

		hook(actor('character', 15), {}, recordedHp(10), 'user-2');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('ignores actors that are not characters', async () => {
		const hook = await registeredHook();

		hook(actor('npc', 15), {}, recordedHp(10), 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});
});
