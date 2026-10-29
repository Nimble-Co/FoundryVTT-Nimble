import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { removeMarkEffect } = vi.hoisted(() => ({
	removeMarkEffect: vi.fn(async () => undefined),
}));

vi.mock('../markTargetEffects.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('../markTargetEffects.js')>()),
	removeMarkEffect,
}));

import { SYSTEM_ID } from '#system';
import { endEncounterMarks, endMarkOfRemovedMarker } from '../markLifecycle.js';
import { MARK_TARGET_ITEM_FLAG } from '../markTargetEffects.js';
import { TOGGLED_EFFECTS_FLAG_KEY, type ToggledEffectsFlag } from '../toggledEffects.js';

const goblin = { actorUuid: 'Actor.goblin', tokenUuid: 'Scene.s.Token.goblin', name: 'Goblin' };
const ogre = { actorUuid: 'Actor.ogre', tokenUuid: null, name: 'Ogre' };

function markRule(flagKey: string, itemUuid: string, endsAtEncounterEnd: boolean) {
	return {
		type: 'markTarget',
		flagKey,
		endsAtEncounterEnd,
		disabled: false,
		item: { uuid: itemUuid },
	};
}

function createOwner(flag: ToggledEffectsFlag, rules: unknown[] = []) {
	let stored = flag;
	return {
		uuid: 'Actor.cheat',
		rules,
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

describe('endEncounterMarks', () => {
	it('ends the marks of the rules that end at the end of the encounter, and only those', async () => {
		const owner = createOwner({ 'exploit-weakness': [goblin, ogre], quarry: [ogre] }, [
			markRule('exploit-weakness', 'Item.exploit', true),
			markRule('quarry', 'Item.mark', false),
		]);
		const goblinActor = { uuid: 'Actor.goblin' };
		const ogreActor = { uuid: 'Actor.ogre' };
		documents['Scene.s.Token.goblin'] = { actor: goblinActor };
		documents['Actor.ogre'] = ogreActor;

		await endEncounterMarks(owner as never);

		expect(owner.setFlag).toHaveBeenCalledWith(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, {
			'exploit-weakness': [],
			quarry: [ogre],
		});
		expect(removeMarkEffect).toHaveBeenCalledWith({
			target: goblinActor,
			sourceItemUuid: 'Item.exploit',
		});
		expect(removeMarkEffect).toHaveBeenCalledWith({
			target: ogreActor,
			sourceItemUuid: 'Item.exploit',
		});
		expect(removeMarkEffect).toHaveBeenCalledTimes(2);
	});

	it('writes nothing when no rule ends at the end of the encounter', async () => {
		const owner = createOwner({ quarry: [ogre] }, [markRule('quarry', 'Item.mark', false)]);

		await endEncounterMarks(owner as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});

	it('writes nothing when the actor has no mark to end', async () => {
		const owner = createOwner({}, [markRule('exploit-weakness', 'Item.exploit', true)]);

		await endEncounterMarks(owner as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});
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
			rules: new Map([['r', markRule('exploit-weakness', 'Item.exploit', true)]]),
		};

		await endMarkOfRemovedMarker(marker('Item.exploit') as never);

		expect(owner.stored).toEqual({ 'exploit-weakness': [ogre], quarry: [goblin] });
	});

	it('does nothing for an effect that is not a marker', async () => {
		const owner = createOwner({ quarry: [goblin] });
		documents['Item.mark'] = {
			actor: owner,
			rules: new Map([['r', markRule('quarry', 'Item.mark', false)]]),
		};

		await endMarkOfRemovedMarker(marker(undefined) as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});

	it('does nothing when the mark is already gone, as after an eviction', async () => {
		const owner = createOwner({ quarry: [ogre] });
		documents['Item.mark'] = {
			actor: owner,
			rules: new Map([['r', markRule('quarry', 'Item.mark', false)]]),
		};

		await endMarkOfRemovedMarker(marker('Item.mark') as never);

		expect(owner.setFlag).not.toHaveBeenCalled();
	});
});
