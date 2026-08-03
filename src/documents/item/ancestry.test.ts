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

async function runAncestryPreCreate(ancestry: unknown) {
	return NimbleAncestryItem.prototype._preCreate.call(
		ancestry as NimbleAncestryItem,
		{} as never,
		{} as never,
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

	it('deletes the stale bonus when the incoming ancestry declares no default', async () => {
		const existingBonus = { delete: vi.fn(async () => undefined) };
		const actor = createActor({ ancestryBonus: existingBonus });

		await runAncestryPreCreate(createIncomingAncestry(actor, ''));

		expect(existingBonus.delete).toHaveBeenCalled();
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
