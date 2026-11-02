import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const globals = globalThis as unknown as Record<string, any>;

function target() {
	return {
		actor: {
			uuid: 'Actor.t',
			isOwner: true,
			createEmbeddedDocuments: vi.fn(async () => []),
		},
	};
}

async function capturedHook() {
	vi.resetModules();
	const on = vi.fn();
	globals.Hooks = { ...globals.Hooks, on };
	const { registerHoldOnTargetHooks } = await import('../holdOnTargetOnUse.js');
	registerHoldOnTargetHooks();
	return on.mock.calls[0]?.[1] as (item: object, card: null, context: object) => Promise<void>;
}

const item = (rule: object) => ({
	name: 'Grease Trap',
	rules: new Map([['0', { type: 'holdOnTarget', ...rule }]]),
});

describe('holdOnTarget on an item use', () => {
	let savedHooks: unknown;

	beforeEach(() => {
		savedHooks = globals.Hooks;
		globals.game.combat = { id: 'c1', started: true, round: 2, turn: 1 };
		globals.game.settings = { get: () => true };
	});

	afterEach(() => {
		globals.Hooks = savedHooks;
		delete globals.game.combat;
		delete globals.game.settings;
	});

	it('holds the change on each target, until the combat ends', async () => {
		const hook = await capturedHook();
		const token = target();

		await hook(item({ heldKind: 'vulnerableOnce', damageType: 'fire' }), null, {
			targets: [token],
		});

		const [, [effect]] = token.actor.createEmbeddedDocuments.mock.calls[0] as unknown as [
			string,
			[{ flags: { nimble: { heldChange: Record<string, unknown> } } }],
		];
		expect(effect.flags.nimble.heldChange).toMatchObject({
			kind: 'vulnerableOnce',
			damageType: 'fire',
			ends: 'combat',
			combatId: 'c1',
		});
	});

	it('holds nothing on a miss, or outside combat', async () => {
		const hook = await capturedHook();
		const token = target();

		await hook(item({ heldKind: 'mustAttackOther' }), null, { isMiss: true, targets: [token] });
		globals.game.combat = null;
		await hook(item({ heldKind: 'mustAttackOther' }), null, { targets: [token] });

		expect(token.actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
