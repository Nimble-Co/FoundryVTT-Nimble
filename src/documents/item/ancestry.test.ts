import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NimbleAncestryItem } from './ancestry.js';
import { NimbleAncestryBonusItem } from './ancestryBonus.js';

type GlobalWithFromUuid = { fromUuid: unknown };

const DEFAULT_BONUS_UUID = 'Compendium.nimble.nimble-ancestry-bonuses.Item.stout';

/**
 * Both hooks end in `super._preCreate(...)`. The shared `Item` mock has no such method, so
 * stand one up for the duration of this file rather than reaching into the shared mocks.
 */
const itemPrototype = (globalThis as unknown as { Item: { prototype: Record<string, unknown> } })
	.Item.prototype;

beforeEach(() => {
	itemPrototype._preCreate = vi.fn(async () => true);
});

afterEach(() => {
	delete itemPrototype._preCreate;
});

function createActor(overrides: Record<string, unknown> = {}) {
	return {
		type: 'character',
		ancestry: undefined as { delete: ReturnType<typeof vi.fn> } | undefined,
		ancestryBonus: undefined as { delete: ReturnType<typeof vi.fn> } | undefined,
		createEmbeddedDocuments: vi.fn(async () => []),
		...overrides,
	};
}

/**
 * Stands in for the incoming ancestry document. `_preCreate` is called off the prototype
 * so the hook runs against this shape without constructing a real Foundry document.
 */
function createIncomingAncestry(actor: unknown, defaultBonus: string) {
	return {
		name: 'Elf',
		isEmbedded: true,
		parent: actor,
		system: { defaultBonus },
	};
}

async function runAncestryPreCreate(ancestry: unknown, options: Record<string, unknown> = {}) {
	return NimbleAncestryItem.prototype._preCreate.call(
		ancestry as NimbleAncestryItem,
		{} as never,
		options as never,
		{} as never,
	);
}

describe('NimbleAncestryItem._preCreate', () => {
	let originalFromUuid: unknown;

	beforeEach(() => {
		originalFromUuid = (globalThis as unknown as GlobalWithFromUuid).fromUuid;
	});

	afterEach(() => {
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = originalFromUuid;
		vi.restoreAllMocks();
	});

	it('replaces the outgoing ancestry and grants the incoming default bonus', async () => {
		const bonusSource = { name: 'Stout', _stats: { compendiumSource: '' } };
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi
			.fn()
			.mockResolvedValue({ toObject: () => bonusSource });

		const actor = createActor({ ancestry: { delete: vi.fn(async () => undefined) } });
		await runAncestryPreCreate(createIncomingAncestry(actor, DEFAULT_BONUS_UUID));

		expect(actor.ancestry?.delete).toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith('Item', [bonusSource]);
		// Stamped so the granted bonus is traceable back to its pack entry.
		expect(bonusSource._stats.compendiumSource).toBe(DEFAULT_BONUS_UUID);
	});

	it('keeps the existing bonus when the incoming ancestry declares no default', async () => {
		// No default means the ancestry has no opinion about the bonus — the homebrew and module
		// case the selection UI treats as "choose any bonus". Deleting the player's pick there
		// would throw away a deliberate choice with no prompt.
		const existingBonus = { delete: vi.fn(async () => undefined) };
		const actor = createActor({ ancestryBonus: existingBonus });

		await runAncestryPreCreate(createIncomingAncestry(actor, ''));

		expect(existingBonus.delete).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('skips the default bonus when the create batch already carries one', async () => {
		// `submitCharacterCreation` creates ancestry and bonus together. Granting the default here
		// would only be deleted again by that bonus's own `_preCreate`, running any `grantItem`
		// rule or active effect on a document that is about to disappear.
		const fromUuid = vi.fn();
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = fromUuid;

		const actor = createActor({ ancestry: { delete: vi.fn(async () => undefined) } });
		await runAncestryPreCreate(createIncomingAncestry(actor, DEFAULT_BONUS_UUID), {
			nimbleAncestryBonusInBatch: true,
		});

		// The outgoing ancestry still goes; only the bonus grant is skipped.
		expect(actor.ancestry?.delete).toHaveBeenCalled();
		expect(fromUuid).not.toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('deletes the stale bonus when the default bonus cannot be resolved', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		(globalThis as unknown as GlobalWithFromUuid).fromUuid = vi.fn().mockResolvedValue(null);

		const existingBonus = { delete: vi.fn(async () => undefined) };
		const actor = createActor({ ancestryBonus: existingBonus });

		await runAncestryPreCreate(createIncomingAncestry(actor, DEFAULT_BONUS_UUID));

		expect(existingBonus.delete).toHaveBeenCalled();
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		expect(consoleWarn).toHaveBeenCalled();
	});

	it('refuses to embed on anything but a character', async () => {
		const actor = createActor({ type: 'npc' });

		const result = await runAncestryPreCreate(createIncomingAncestry(actor, DEFAULT_BONUS_UUID));

		expect(result).toBe(false);
		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe('NimbleAncestryItem.prepareBaseData', () => {
	// Same reason as `_preCreate` above: the base class ends in `super.prepareBaseData()`, and the
	// shared `Item` mock has no such method.
	beforeEach(() => {
		itemPrototype.prepareBaseData = vi.fn();
	});

	afterEach(() => {
		delete itemPrototype.prepareBaseData;
	});

	/**
	 * Built on the real prototype so the base class's own data prep runs — it derives the identifier
	 * from the name, populates tags, and builds a rules manager, all against these fields.
	 */
	function createPreparedAncestry(name: string, authoredIdentifier: string) {
		const ancestry = Object.assign(Object.create(NimbleAncestryItem.prototype), {
			name,
			_source: { system: { identifier: authoredIdentifier } },
			system: { identifier: '', rules: [] },
			type: 'ancestry',
		}) as NimbleAncestryItem & { system: { identifier: string } };

		ancestry.prepareBaseData();

		return ancestry;
	}

	it('keeps the identifier the ancestry declares, whatever the variant renamed it to', () => {
		// A character who chose "Shroomling" carries an ancestry renamed to it, and the ancestry
		// identifier is what keys the GM's language grants.
		const ancestry = createPreparedAncestry('Shroomling', 'dryadshroomling');

		expect(ancestry.system.identifier).toBe('dryadshroomling');
	});

	it('derives the identifier from the name when the ancestry declares none', () => {
		const ancestry = createPreparedAncestry('Half-Giant', '');

		expect(ancestry.system.identifier).toBe('half-giant');
	});
});

describe('NimbleAncestryBonusItem._preCreate', () => {
	async function runBonusPreCreate(bonus: unknown) {
		return NimbleAncestryBonusItem.prototype._preCreate.call(
			bonus as NimbleAncestryBonusItem,
			{} as never,
			{} as never,
			{} as never,
		);
	}

	it('deletes the bonus the character already has, so only one is ever attached', async () => {
		const existingBonus = { delete: vi.fn(async () => undefined) };
		const actor = createActor({ ancestryBonus: existingBonus });

		await runBonusPreCreate({ isEmbedded: true, parent: actor });

		expect(existingBonus.delete).toHaveBeenCalled();
	});

	it('is a no-op when the character has no bonus yet', async () => {
		const actor = createActor();

		await expect(runBonusPreCreate({ isEmbedded: true, parent: actor })).resolves.not.toBe(false);
	});

	it('refuses to embed on anything but a character', async () => {
		const actor = createActor({ type: 'npc' });

		expect(await runBonusPreCreate({ isEmbedded: true, parent: actor })).toBe(false);
	});
});
