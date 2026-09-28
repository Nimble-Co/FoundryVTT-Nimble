import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

const isActiveGM = vi.fn(() => true);
vi.mock('#utils/isActiveGM.js', () => ({ isActiveGM: () => isActiveGM() }));

const hookListeners = new Map<string, (...args: never[]) => void>();
vi.stubGlobal('Hooks', {
	on: (hook: string, listener: (...args: never[]) => void) => {
		hookListeners.set(hook, listener);
		return 1;
	},
});

// The shared foundry mock has no `hasProperty`, which `hasAnyActorChangeAt` needs to read the
// `updateActor` diff. Filled in here rather than in the shared mock, as ruleEventDispatch does.
(
	globalThis as unknown as { foundry: { utils: Record<string, unknown> } }
).foundry.utils.hasProperty = (target: unknown, path: string) => {
	let cursor: unknown = target;
	for (const segment of path.split('.')) {
		if (cursor === null || typeof cursor !== 'object') return false;
		if (!(segment in (cursor as Record<string, unknown>))) return false;
		cursor = (cursor as Record<string, unknown>)[segment];
	}
	return true;
};

const registerConditionExpiryHooks = (await import('./conditionExpiry.js')).default;

// The module registers its listener once per load, so the listener captured here is the one every
// test drives.
registerConditionExpiryHooks();

interface MockEffect {
	id: string;
	statuses: Set<string>;
	flags: Record<string, Record<string, unknown>>;
}

interface MockActor {
	uuid: string;
	effects: MockEffect[];
	system: { attributes: { hp: { value: number; max: number } } };
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

function createEffect(id: string, condition: string, linkedActorUuid?: string): MockEffect {
	return {
		id,
		statuses: new Set([condition]),
		flags: linkedActorUuid ? { [SYSTEM_ID]: { linkedActorUuid } } : {},
	};
}

function createActor(uuid: string, hp: number, effects: MockEffect[] = []): MockActor {
	return {
		uuid,
		effects,
		system: { attributes: { hp: { value: hp, max: 20 } } },
		deleteEmbeddedDocuments: vi.fn(),
	};
}

let worldActors: MockActor[] = [];

function setWorldActors(actors: MockActor[]) {
	worldActors = actors;
	(globalThis as unknown as { game: { actors: unknown } }).game.actors = worldActors;
}

function fireActorUpdate(actor: MockActor) {
	const listener = hookListeners.get('updateActor') as
		| ((actor: unknown, changes: unknown) => void)
		| undefined;
	listener?.(actor, {
		system: { attributes: { hp: { value: actor.system.attributes.hp.value } } },
	});
}

describe('conditionExpiry', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		isActiveGM.mockReturnValue(true);
		vi.stubGlobal('canvas', { tokens: { placeables: [] } });
	});

	it('clears a linked-death condition from the creature the dead one was linked to', async () => {
		const stirgeEffect = createEffect('effect-1', 'latchedOn', 'Actor.victim');
		const stirge = createActor('Actor.stirge', 8, [stirgeEffect]);
		const victim = createActor('Actor.victim', 0);
		setWorldActors([stirge, victim]);

		fireActorUpdate(victim);
		await vi.waitFor(() => expect(stirge.deleteEmbeddedDocuments).toHaveBeenCalled());

		expect(stirge.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-1']);
	});

	it('clears the condition from the dying carrier itself', async () => {
		const stirgeEffect = createEffect('effect-1', 'latchedOn', 'Actor.victim');
		const stirge = createActor('Actor.stirge', 0, [stirgeEffect]);
		setWorldActors([stirge]);

		fireActorUpdate(stirge);
		await vi.waitFor(() => expect(stirge.deleteEmbeddedDocuments).toHaveBeenCalled());

		expect(stirge.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['effect-1']);
	});

	it('leaves conditions linked to a different creature alone', async () => {
		const stirge = createActor('Actor.stirge', 8, [
			createEffect('effect-1', 'latchedOn', 'Actor.someone-else'),
		]);
		const victim = createActor('Actor.victim', 0);
		setWorldActors([stirge, victim]);

		fireActorUpdate(victim);
		await Promise.resolve();

		expect(stirge.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('leaves conditions with no bespoke expiry trigger alone', async () => {
		const stirge = createActor('Actor.stirge', 8, [
			createEffect('effect-1', 'frightened', 'Actor.victim'),
		]);
		const victim = createActor('Actor.victim', 0);
		setWorldActors([stirge, victim]);

		fireActorUpdate(victim);
		await Promise.resolve();

		expect(stirge.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('does nothing while the updated actor is still alive', async () => {
		const stirge = createActor('Actor.stirge', 8, [
			createEffect('effect-1', 'latchedOn', 'Actor.victim'),
		]);
		const victim = createActor('Actor.victim', 4);
		setWorldActors([stirge, victim]);

		fireActorUpdate(victim);
		await Promise.resolve();

		expect(stirge.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('leaves the deletions to the active GM', async () => {
		isActiveGM.mockReturnValue(false);
		const stirge = createActor('Actor.stirge', 8, [
			createEffect('effect-1', 'latchedOn', 'Actor.victim'),
		]);
		const victim = createActor('Actor.victim', 0);
		setWorldActors([stirge, victim]);

		fireActorUpdate(victim);
		await Promise.resolve();

		expect(stirge.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
