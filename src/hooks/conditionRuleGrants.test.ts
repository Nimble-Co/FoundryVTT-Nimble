import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID, systemHookName } from '#system';

const isActiveGM = vi.fn(() => true);
vi.mock('#utils/isActiveGM.js', () => ({ isActiveGM: () => isActiveGM() }));

const hookListeners = new Map<string, (...args: never[]) => void>();
vi.stubGlobal('Hooks', {
	on: (hook: string, listener: (...args: never[]) => void) => {
		hookListeners.set(hook, listener);
		return 1;
	},
});

const registerConditionRuleGrantHooks = (await import('./conditionRuleGrants.js')).default;

// The module registers its listeners once per load, so the listeners captured here are the ones
// every test drives.
registerConditionRuleGrantHooks();

interface MockItem {
	id: string;
	name: string;
	system: { identifier: string };
	flags?: Record<string, Record<string, unknown>>;
	toObject(): Record<string, unknown>;
}

interface MockActor {
	uuid: string;
	items: MockItem[];
	createEmbeddedDocuments: ReturnType<typeof vi.fn>;
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

function createItem(id: string, name: string, identifier: string): MockItem {
	const item: MockItem = {
		id,
		name,
		system: { identifier },
		toObject: () => ({
			_id: id,
			name,
			type: 'monsterFeature',
			system: { identifier, rules: [{ type: 'recurringDamage' }] },
		}),
	};
	return item;
}

function createActor(uuid: string, items: MockItem[] = []): MockActor {
	return {
		uuid,
		items,
		createEmbeddedDocuments: vi.fn(),
		deleteEmbeddedDocuments: vi.fn(),
	};
}

function fireConditionApplied(payload: unknown) {
	const listener = hookListeners.get(systemHookName('conditionApplied')) as
		| ((payload: unknown) => void)
		| undefined;
	listener?.(payload);
}

function fireEffectDeleted(effect: unknown) {
	const listener = hookListeners.get('deleteActiveEffect') as
		| ((effect: unknown) => void)
		| undefined;
	listener?.(effect);
}

describe('conditionRuleGrants', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		isActiveGM.mockReturnValue(true);
	});

	it('copies the feature carrying the condition onto the creature that gained it', async () => {
		const swallowedFeature = createItem('feature-1', 'Swallowed.', 'swallowed');
		const worm = createActor('Actor.worm', [swallowedFeature]);
		const victim = createActor('Actor.victim');

		fireConditionApplied({
			target: victim,
			condition: 'swallowed',
			effect: { id: 'effect-1' },
			source: { actor: worm },
		});
		await vi.waitFor(() => expect(victim.createEmbeddedDocuments).toHaveBeenCalled());

		const [type, [created]] = victim.createEmbeddedDocuments.mock.calls[0];
		expect(type).toBe('Item');
		expect(created.name).toBe('Swallowed.');
		expect(created._id).toBeUndefined();
		expect(created.flags[SYSTEM_ID].conditionGrant).toEqual({
			condition: 'swallowed',
			effectId: 'effect-1',
		});
	});

	it('resolves the source actor from the feature that applied the condition', async () => {
		const swallowedFeature = createItem('feature-1', 'Swallowed.', 'swallowed');
		const worm = createActor('Actor.worm', [swallowedFeature]);
		const bite = { name: 'Bite/Swallow.', actor: worm };
		const victim = createActor('Actor.victim');

		fireConditionApplied({
			target: victim,
			condition: 'swallowed',
			effect: { id: 'effect-1' },
			source: bite,
		});
		await vi.waitFor(() => expect(victim.createEmbeddedDocuments).toHaveBeenCalled());
	});

	it('grants nothing when the creature already carries the feature', async () => {
		const latchedOn = createItem('feature-1', 'Latched On.', 'latchedOn');
		const stirge = createActor('Actor.stirge', [latchedOn]);

		fireConditionApplied({
			target: stirge,
			condition: 'latchedOn',
			effect: { id: 'effect-1' },
			source: { actor: stirge },
		});
		await Promise.resolve();

		expect(stirge.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('grants nothing for a general-scoped condition', async () => {
		const feature = createItem('feature-1', 'Frightened.', 'frightened');
		const source = createActor('Actor.source', [feature]);
		const victim = createActor('Actor.victim');

		fireConditionApplied({
			target: victim,
			condition: 'frightened',
			effect: { id: 'effect-1' },
			source: { actor: source },
		});
		await Promise.resolve();

		expect(victim.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('grants nothing when the source actor has no matching feature', async () => {
		const worm = createActor('Actor.worm', [createItem('feature-1', 'Crush.', '')]);
		const victim = createActor('Actor.victim');

		fireConditionApplied({
			target: victim,
			condition: 'swallowed',
			effect: { id: 'effect-1' },
			source: { actor: worm },
		});
		await Promise.resolve();

		expect(victim.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('removes the granted feature when the condition ends', async () => {
		const granted = createItem('granted-1', 'Swallowed.', 'swallowed');
		granted.flags = { [SYSTEM_ID]: { conditionGrant: { condition: 'swallowed', effectId: 'e1' } } };
		const untouched = createItem('other-1', 'Backpack', '');
		const victim = createActor('Actor.victim', [granted, untouched]);

		fireEffectDeleted({ id: 'e1', parent: victim });
		await vi.waitFor(() => expect(victim.deleteEmbeddedDocuments).toHaveBeenCalled());

		expect(victim.deleteEmbeddedDocuments).toHaveBeenCalledWith('Item', ['granted-1']);
	});

	it('leaves features granted by a different condition in place', async () => {
		const granted = createItem('granted-1', 'Swallowed.', 'swallowed');
		granted.flags = { [SYSTEM_ID]: { conditionGrant: { condition: 'swallowed', effectId: 'e1' } } };
		const victim = createActor('Actor.victim', [granted]);

		fireEffectDeleted({ id: 'e2', parent: victim });
		await Promise.resolve();

		expect(victim.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('leaves the item creation to the active GM', async () => {
		isActiveGM.mockReturnValue(false);
		const worm = createActor('Actor.worm', [createItem('feature-1', 'Swallowed.', 'swallowed')]);
		const victim = createActor('Actor.victim');

		fireConditionApplied({
			target: victim,
			condition: 'swallowed',
			effect: { id: 'effect-1' },
			source: { actor: worm },
		});
		await Promise.resolve();

		expect(victim.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
