import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../../tests/helpers.js';
import {
	type CombatDefeatSyncTestGlobals,
	createHookCapture,
} from '../../../../tests/mocks/combat.js';

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	applyRefillToActorIfEligible: vi.fn(async () => {}),
}));

import { applyRefillToActorIfEligible } from '#utils/dicePool/dicePoolRefill.js';

function globals() {
	return getTestGlobals<
		CombatDefeatSyncTestGlobals & { game: { combat: Combat | null; user: { isGM: boolean } } }
	>();
}

describe('registerAttackedTriggerHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
		globals().game.combat = null;
	});

	it('registers nimble.damageApplied hook for incoming-damage detection', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const damageHook = callbacks.get('nimble.damageApplied');
		expect(damageHook).toBeDefined();
	});

	it('does not throw when target is not a character', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const npcTarget = {
			id: 'npc-target',
			type: 'npc',
			name: 'Goblin',
		} as unknown as Actor.Implementation;

		const damageHook = callbacks.get('nimble.damageApplied');
		let threw = false;
		try {
			damageHook?.({ targetActor: npcTarget });
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	it('fires onAttacked but not onCritReceived for a normal hit', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const target = { id: 'hero', type: 'character' } as unknown as Actor.Implementation;
		callbacks.get('nimble.damageApplied')?.({ targetActor: target, isCritical: false });

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onAttacked');
		expect(applyRefillToActorIfEligible).not.toHaveBeenCalledWith(target, 'onCritReceived');
	});

	it('fires onCritReceived for a crit that a reroll discarded when the reroll keeps its crit triggers', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const target = { id: 'hero', type: 'character' } as unknown as Actor.Implementation;
		callbacks.get('nimble.damageApplied')?.({
			targetActor: target,
			isCritical: false,
			discardedCritTriggers: true,
		});

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onCritReceived');
	});

	it('fires onCritReceived in addition to onAttacked for a critical hit', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const target = { id: 'hero', type: 'character' } as unknown as Actor.Implementation;
		callbacks.get('nimble.damageApplied')?.({ targetActor: target, isCritical: true });

		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onAttacked');
		expect(applyRefillToActorIfEligible).toHaveBeenCalledWith(target, 'onCritReceived');
	});

	it('does not throw when payload has no target', async () => {
		const callbacks = createHookCapture(globals().Hooks.on);
		const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
		registerAttackedTriggerHooks();

		const damageHook = callbacks.get('nimble.damageApplied');
		let threw = false;
		try {
			damageHook?.({});
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});

	describe('from the attack card', () => {
		const hero = { uuid: 'Actor.hero', id: 'hero', type: 'character' };
		const speaker = { actor: 'monster' };
		const damage = { type: 'damage', roll: { class: 'DamageRoll' }, on: {} };

		function attackCard(targets: string[], flag?: string[]) {
			const flags: Record<string, unknown> = flag ? { attackedActors: flag } : {};
			return {
				id: 'card',
				type: 'feature',
				speaker,
				system: { targets, isMiss: true, activation: { effects: [damage] } },
				getFlag: (_scope: string, key: string) => flags[key],
				setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
					flags[key] = value;
				}),
			};
		}

		async function register() {
			const callbacks = createHookCapture(globals().Hooks.on);
			const { registerAttackedTriggerHooks } = await import('../attackedTrigger.js');
			registerAttackedTriggerHooks();
			return callbacks;
		}

		afterEach(() => vi.unstubAllGlobals());

		const flush = () => new Promise((resolve) => setTimeout(resolve));
		const attacked = () =>
			vi
				.mocked(applyRefillToActorIfEligible)
				.mock.calls.filter(([, trigger]) => trigger === 'onAttacked');

		beforeEach(() => {
			vi.stubGlobal('fromUuidSync', (uuid: string) =>
				uuid === 'Token.hero' ? { actor: hero } : null,
			);
			(game as unknown as { user: object }).user = { id: 'gm', isGM: true };
		});

		it('fires for a target of an attack that misses, with no damage applied', async () => {
			const callbacks = await register();

			callbacks.get('createChatMessage')?.(attackCard(['Token.hero']));
			await flush();

			expect(attacked()).toEqual([[hero, 'onAttacked']]);
		});

		it('does not fire again for a reroll of the same card', async () => {
			const callbacks = await register();
			const card = attackCard(['Token.hero']);

			callbacks.get('createChatMessage')?.(card);
			await flush();
			callbacks.get('updateChatMessage')?.(card);
			await flush();

			expect(attacked()).toHaveLength(1);
		});

		it('does not fire again when the damage of that card applies', async () => {
			const callbacks = await register();
			const card = attackCard(['Token.hero']);

			callbacks.get('createChatMessage')?.(card);
			await flush();
			callbacks.get('nimble.damageApplied')?.({ targetActor: hero, card });
			await flush();

			expect(attacked()).toHaveLength(1);
		});

		it('fires for a target added to the card later', async () => {
			const callbacks = await register();
			const card = attackCard([]);

			callbacks.get('createChatMessage')?.(card);
			await flush();
			expect(attacked()).toHaveLength(0);

			card.system.targets = ['Token.hero'];
			callbacks.get('updateChatMessage')?.(card);
			await flush();

			expect(attacked()).toHaveLength(1);
		});

		it('fires when damage applies to a creature that is not a target of the card', async () => {
			const callbacks = await register();
			const card = attackCard([]);

			callbacks.get('createChatMessage')?.(card);
			await flush();
			callbacks.get('nimble.damageApplied')?.({ targetActor: hero, card });
			await flush();

			expect(attacked()).toHaveLength(1);
			expect(card.setFlag).toHaveBeenLastCalledWith(expect.anything(), 'attackedActors', [
				'Actor.hero',
			]);
		});

		it('does not fire from an update of a card older than this event', async () => {
			const callbacks = await register();

			callbacks.get('updateChatMessage')?.(attackCard(['Token.hero']));
			await flush();

			expect(attacked()).toHaveLength(0);
		});

		it('does not fire for a card with no damage', async () => {
			const callbacks = await register();
			const card = attackCard(['Token.hero']);
			card.system.activation.effects = [];

			callbacks.get('createChatMessage')?.(card);
			await flush();

			expect(attacked()).toHaveLength(0);
		});
	});
});
