import { beforeEach, describe, expect, it, vi } from 'vitest';

type HookCallback = (...args: unknown[]) => unknown;

type TestGlobals = {
	Hooks: {
		on: ReturnType<typeof vi.fn>;
	};
	game: {
		user: {
			isGM: boolean;
		};
		combats: {
			contents: Combat[];
		};
	};
	foundry: {
		utils: {
			hasProperty: (obj: unknown, path: string) => boolean;
		};
	};
	CONFIG: {
		specialStatusEffects: {
			DEFEATED: string;
		};
	};
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createActor({
	id,
	hp,
	woundsValue,
	woundsMax,
}: {
	id: string;
	hp: number;
	woundsValue?: number;
	woundsMax?: number;
}) {
	return {
		id,
		system: {
			attributes: {
				hp: { value: hp },
				wounds: { value: woundsValue, max: woundsMax },
			},
		},
		toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
	} as unknown as Actor.Implementation;
}

function createCombatant({
	id,
	type,
	actorId,
	actor,
	defeated,
	actionsCurrent,
	actionsMax,
}: {
	id: string;
	type: string;
	actorId: string;
	actor: Actor.Implementation;
	defeated: boolean;
	actionsCurrent: number;
	actionsMax: number;
}) {
	return {
		id,
		actorId,
		actor,
		type,
		defeated,
		system: {
			actions: {
				base: {
					current: actionsCurrent,
					max: actionsMax,
				},
			},
		},
	} as unknown as Combatant.Implementation;
}

function createCombat({
	id,
	combatants,
	turns,
	activeCombatant,
	round,
}: {
	id: string;
	combatants: Combatant.Implementation[];
	turns: Combatant.Implementation[];
	activeCombatant: Combatant.Implementation | null;
	round: number;
}) {
	return {
		id,
		combatants: { contents: combatants },
		turns,
		combatant: activeCombatant,
		round,
		updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
		nextTurn: vi.fn().mockResolvedValue(undefined),
	} as unknown as Combat;
}

function createHookCapture() {
	const callbacks = new Map<string, HookCallback>();
	globals().Hooks.on.mockImplementation((event: string, callback: HookCallback) => {
		callbacks.set(event, callback);
		return 1;
	});

	return callbacks;
}

async function flushAsync() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('registerCombatantDefeatSync', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { isGM: true };
		globals().game.combats = { contents: [] };

		globals().foundry.utils.hasProperty = (obj: unknown, path: string) => {
			const keys = path.split('.');
			let current = obj as Record<string, unknown> | undefined;
			for (const key of keys) {
				if (!current || typeof current !== 'object' || !(key in current)) return false;
				current = current[key] as Record<string, unknown> | undefined;
			}
			return true;
		};

		globals().CONFIG.specialStatusEffects = {
			DEFEATED: 'defeated',
		};
	});

	it('marks character combatants defeated when wounds reach max and clears actions', async () => {
		const callbacks = createHookCapture();
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createActor({
			id: 'actor-1',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const combatant = createCombatant({
			id: 'combatant-1',
			type: 'character',
			actorId: 'actor-1',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 3,
		});
		const combat = createCombat({
			id: 'combat-1',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		expect(updateActor).toBeDefined();
		updateActor?.(actor, { system: { attributes: { wounds: { value: 6 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-1',
				defeated: true,
				'system.actions.base.current': 0,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: true,
		});
	});

	it('restores character combatants when wounds drop below max', async () => {
		const callbacks = createHookCapture();
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createActor({
			id: 'actor-2',
			hp: 1,
			woundsValue: 2,
			woundsMax: 6,
		});
		const combatant = createCombatant({
			id: 'combatant-2',
			type: 'character',
			actorId: 'actor-2',
			actor,
			defeated: true,
			actionsCurrent: 0,
			actionsMax: 3,
		});
		const combat = createCombat({
			id: 'combat-2',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { value: 2 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-2',
				defeated: false,
				'system.actions.base.current': 3,
			},
		]);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith('defeated', {
			overlay: true,
			active: false,
		});
	});

	it('uses HP logic for non-character combatants', async () => {
		const callbacks = createHookCapture();
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createActor({
			id: 'actor-3',
			hp: 0,
			woundsValue: 0,
			woundsMax: 6,
		});
		const combatant = createCombatant({
			id: 'combatant-3',
			type: 'npc',
			actorId: 'actor-3',
			actor,
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createCombat({
			id: 'combat-3',
			combatants: [combatant],
			turns: [combatant],
			activeCombatant: combatant,
			round: 1,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { hp: { value: 0 } } } });
		await flushAsync();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'combatant-3',
				defeated: true,
				'system.actions.base.current': 0,
			},
		]);
	});

	it('advances turn when active combatant becomes defeated and others are alive', async () => {
		const callbacks = createHookCapture();
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createActor({
			id: 'actor-4',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const deadCombatant = createCombatant({
			id: 'combatant-4a',
			type: 'character',
			actorId: 'actor-4',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 2,
		});
		const aliveOther = createCombatant({
			id: 'combatant-4b',
			type: 'npc',
			actorId: 'other-actor',
			actor: createActor({ id: 'other-actor', hp: 10 }),
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createCombat({
			id: 'combat-4',
			combatants: [deadCombatant, aliveOther],
			turns: [deadCombatant, aliveOther],
			activeCombatant: deadCombatant,
			round: 2,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { value: 6 } } } });
		await flushAsync();

		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
	});

	it('does not advance turn at round 0 even when active combatant becomes defeated', async () => {
		const callbacks = createHookCapture();
		const registerCombatantDefeatSync = (await import('./combatantDefeatSync.js')).default;
		registerCombatantDefeatSync();

		const actor = createActor({
			id: 'actor-5',
			hp: 0,
			woundsValue: 6,
			woundsMax: 6,
		});
		const deadCombatant = createCombatant({
			id: 'combatant-5a',
			type: 'character',
			actorId: 'actor-5',
			actor,
			defeated: false,
			actionsCurrent: 2,
			actionsMax: 2,
		});
		const aliveOther = createCombatant({
			id: 'combatant-5b',
			type: 'npc',
			actorId: 'other-actor-5',
			actor: createActor({ id: 'other-actor-5', hp: 8 }),
			defeated: false,
			actionsCurrent: 1,
			actionsMax: 1,
		});
		const combat = createCombat({
			id: 'combat-5',
			combatants: [deadCombatant, aliveOther],
			turns: [deadCombatant, aliveOther],
			activeCombatant: deadCombatant,
			round: 0,
		});

		globals().game.combats.contents = [combat];

		const updateActor = callbacks.get('updateActor');
		updateActor?.(actor, { system: { attributes: { wounds: { max: 6 } } } });
		await flushAsync();

		expect(combat.nextTurn).not.toHaveBeenCalled();
	});
});
