import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';
import { MARK_TARGET_ITEM_FLAG } from '../markTargetEffects.js';
import type { ToggledEffectsFlag } from '../toggledEffects.js';

const removeMarkEffect = vi.fn(async () => undefined);

type Lifecycle = typeof import('../markLifecycle.js');
let endMark: Lifecycle['endMark'];
let endMarkOfRemovedMarker: Lifecycle['endMarkOfRemovedMarker'];
let markerEffectIds: Lifecycle['markerEffectIds'];
let marksOfItem: Lifecycle['marksOfItem'];
let registerMarkLifecycleHooks: Lifecycle['registerMarkLifecycleHooks'];

// The actor document imports markLifecycle, so test setup has it cached with the real relay.
beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../markTargetEffects.js', async (importOriginal) => ({
		...(await importOriginal<typeof import('../markTargetEffects.js')>()),
		removeMarkEffect,
	}));
	({ endMark, endMarkOfRemovedMarker, markerEffectIds, marksOfItem, registerMarkLifecycleHooks } =
		await import('../markLifecycle.js'));
});

const goblin = { actorUuid: 'Actor.goblin', tokenUuid: 'Scene.s.Token.goblin', name: 'Goblin' };
const ogre = { actorUuid: 'Actor.ogre', tokenUuid: null, name: 'Ogre' };

function markRule(flagKey: string) {
	return { type: 'markTarget', flagKey, disabled: false };
}

function createOwner(flag: ToggledEffectsFlag) {
	let stored = flag;
	return {
		uuid: 'Actor.cheat',
		getFlag: vi.fn(() => stored),
		setFlag: vi.fn(async (_scope: string, _key: string, value: ToggledEffectsFlag) => {
			stored = value;
		}),
		get stored() {
			return stored;
		},
	};
}

const documents: Record<string, unknown> = {};

beforeEach(() => {
	vi.stubGlobal(
		'fromUuid',
		vi.fn(async (uuid: string) => documents[uuid] ?? null),
	);
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => documents[uuid] ?? null),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	for (const key of Object.keys(documents)) delete documents[key];
});

describe('endMarkOfRemovedMarker', () => {
	function marker(itemUuid: string | undefined, parentUuid = 'Actor.goblin') {
		return {
			parent: { uuid: parentUuid },
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === MARK_TARGET_ITEM_FLAG ? itemUuid : undefined,
		};
	}

	it('takes the creature off the list of the item that made the marker', async () => {
		const owner = createOwner({ 'exploit-weakness': [goblin, ogre], quarry: [goblin] });
		documents['Item.exploit'] = {
			actor: owner,
			rules: new Map([['r', markRule('exploit-weakness')]]),
		};

		await endMarkOfRemovedMarker(marker('Item.exploit') as never);

		expect(owner.stored).toEqual({ 'exploit-weakness': [ogre], quarry: [goblin] });
	});

	it('does nothing for an effect that is not a marker', async () => {
		const owner = createOwner({ quarry: [goblin] });
		documents['Item.mark'] = {
			actor: owner,
			rules: new Map([['r', markRule('quarry')]]),
		};

		await endMarkOfRemovedMarker(marker(undefined) as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});

	it('does nothing when the mark is already gone, as after an eviction', async () => {
		const owner = createOwner({ quarry: [ogre] });
		documents['Item.mark'] = {
			actor: owner,
			rules: new Map([['r', markRule('quarry')]]),
		};

		await endMarkOfRemovedMarker(marker('Item.mark') as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});

	it('drops the mark when a moment of its Lasts Until deletes the marker, on the active GM', async () => {
		const handlers = new Map<string, (...args: unknown[]) => unknown>();
		vi.stubGlobal('Hooks', {
			on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
				handlers.set(event, handler);
				return 1;
			}),
		});
		vi.stubGlobal('game', { user: { id: 'gm', isGM: true }, users: { activeGM: { id: 'gm' } } });
		const owner = createOwner({ 'exploit-weakness': [goblin, ogre] });
		documents['Item.exploit'] = {
			actor: owner,
			rules: new Map([['r', markRule('exploit-weakness')]]),
		};
		registerMarkLifecycleHooks();

		// The Lasts Until engine deletes an ended effect with no options.
		handlers.get('deleteActiveEffect')?.(marker('Item.exploit'), {}, 'gm');
		await vi.waitFor(() => expect(owner.setFlag).toHaveBeenCalled());

		expect(owner.stored).toEqual({ 'exploit-weakness': [ogre] });
	});
});

describe('endMark', () => {
	function markingItem(owner: ReturnType<typeof createOwner>) {
		return {
			uuid: 'Item.exploit',
			actor: owner,
			rules: new Map([['r1', markRule('exploit-weakness')]]),
		};
	}

	it("ends one mark of the item: the owner's record and the marker on the creature", async () => {
		const owner = createOwner({ 'exploit-weakness': [goblin, ogre], quarry: [goblin] });
		const goblinActor = { uuid: 'Actor.goblin' };
		documents['Scene.s.Token.goblin'] = { actor: goblinActor };

		await endMark(markingItem(owner) as never, goblin);

		expect(owner.stored).toEqual({ 'exploit-weakness': [ogre], quarry: [goblin] });
		expect(removeMarkEffect).toHaveBeenCalledWith({
			target: goblinActor,
			sourceItemUuid: 'Item.exploit',
		});
	});

	it('lists the marks the item holds now', () => {
		const owner = createOwner({ 'exploit-weakness': [goblin, ogre], quarry: [goblin] });
		expect(marksOfItem(markingItem(owner) as never)).toEqual([goblin, ogre]);
	});
});

describe('markerEffectIds', () => {
	function effect(id: string, statuses: string[], itemUuid?: string) {
		return {
			id,
			statuses: new Set(statuses),
			getFlag: (scope: string, key: string) =>
				scope === SYSTEM_ID && key === MARK_TARGET_ITEM_FLAG ? itemUuid : undefined,
		};
	}

	it('gives the marker effects that show the status, and no other effect', () => {
		const actor = {
			effects: [
				effect('a', ['marked'], 'Item.exploit'),
				effect('b', ['marked'], 'Item.mark'),
				effect('c', ['marked']),
				effect('d', ['dazed'], 'Item.other'),
			],
		};
		expect(markerEffectIds(actor, 'marked')).toEqual(['a', 'b']);
	});
});
