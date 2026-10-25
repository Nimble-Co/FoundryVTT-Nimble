import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';

const { applyRecovery } = vi.hoisted(() => ({ applyRecovery: vi.fn() }));

vi.mock('../../utils/chargePool/chargePoolRecover.js', () => ({
	applyRecoveryToActorIfEligible: applyRecovery,
}));

type WoundHook = (actor: unknown, changes: unknown, options: unknown, userId: string) => void;

function globals() {
	return getTestGlobals<{ game: { user: { id: string } | null }; Hooks: { on: unknown } }>();
}

function actor(type: string, wounds: number) {
	return { id: 'actor-1', type, system: { attributes: { wounds: { value: wounds, max: 6 } } } };
}

function recordedWounds(wounds: number) {
	return { nimble: { previousWounds: wounds } };
}

async function registeredHook(): Promise<WoundHook> {
	const callbacks = createHookCapture(globals().Hooks.on as never);
	const { registerWoundTriggerHooks } = await import('./woundTrigger.js');
	registerWoundTriggerHooks();
	return callbacks.get('updateActor') as WoundHook;
}

describe('registerWoundTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		applyRecovery.mockClear();
		globals().game.user = { id: 'user-1' };
	});

	it('applies the wound trigger when the character gained a Wound', async () => {
		const hook = await registeredHook();
		const woundedActor = actor('character', 2);

		hook(
			woundedActor,
			{ system: { attributes: { wounds: { value: 2 } } } },
			recordedWounds(1),
			'user-1',
		);

		expect(applyRecovery).toHaveBeenCalledTimes(1);
		expect(applyRecovery).toHaveBeenCalledWith(woundedActor, 'onWound');
	});

	it('does nothing when no Wound was gained', async () => {
		const hook = await registeredHook();

		hook(actor('character', 1), {}, recordedWounds(1), 'user-1');
		hook(actor('character', 0), {}, recordedWounds(1), 'user-1');
		hook(actor('character', 2), {}, {}, 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('only applies on the client of the user who made the update', async () => {
		const hook = await registeredHook();

		hook(actor('character', 2), {}, recordedWounds(1), 'user-2');

		expect(applyRecovery).not.toHaveBeenCalled();
	});

	it('ignores actors that are not characters', async () => {
		const hook = await registeredHook();

		hook(actor('npc', 2), {}, recordedWounds(1), 'user-1');

		expect(applyRecovery).not.toHaveBeenCalled();
	});
});
