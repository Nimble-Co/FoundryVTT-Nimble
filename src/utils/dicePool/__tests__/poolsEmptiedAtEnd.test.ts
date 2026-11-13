import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPools = vi.fn((_actor: unknown) => [] as unknown[]);

let poolsEmptiedAtEnd: typeof import('../poolsEmptiedAtEnd.ts').poolsEmptiedAtEnd;
let poolsLostOnEnd: typeof import('../poolsEmptiedAtEnd.ts').poolsLostOnEnd;

async function load(): Promise<void> {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolSync.js', () => ({ getPools }));
	vi.doMock('../dicePoolSync.js', () => ({ getPools }));
	({ poolsEmptiedAtEnd, poolsLostOnEnd } = await import('../poolsEmptiedAtEnd.ts'));
}

function pool(
	id: string,
	identifier: string,
	scope: 'item' | 'actor',
	sourceItemId: string,
	faces = [3],
) {
	return { id, identifier, scope, sourceItemId, label: `${identifier} dice`, faces };
}

const holder = Object.create(Actor.prototype) as Actor;

function item(isEmbedded: boolean) {
	return Object.assign(Object.create(Item.prototype), {
		id: 'state-item',
		isEmbedded,
		actor: holder,
	});
}

function emptyRule(pools: string[]) {
	return {
		type: 'emptyPoolsAtEnd',
		disabled: false,
		poolIdentifiers: pools,
		appliesTo: () => true,
	};
}

function endingEffect(rules: unknown[], parent: unknown = holder) {
	return {
		parent,
		origin: 'Actor.a.Item.state-item',
		rules: new Map(rules.map((rule, i) => [String(i), rule])),
	};
}

describe('poolsEmptiedAtEnd', () => {
	let origin = item(true);

	beforeEach(async () => {
		getPools.mockReturnValue([
			pool('fury', 'fury', 'item', 'state-item'),
			pool('actor:focus', 'focus', 'actor', 'other-item', []),
			pool('actor:fury', 'fury', 'actor', 'other-item'),
		]);
		origin = item(true);
		vi.stubGlobal('fromUuidSync', (uuid: string) =>
			uuid === 'Actor.a.Item.state-item' ? origin : null,
		);
		await load();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('names the pools that hold dice, for the delete confirm', () => {
		expect(poolsLostOnEnd(endingEffect([emptyRule(['fury', 'focus'])]))).toEqual(['fury dice']);
		expect(poolsLostOnEnd(endingEffect([]))).toEqual([]);
		expect(poolsLostOnEnd({ parent: null })).toEqual([]);
	});

	it('uses the pool of the holder when the origin item is not embedded', () => {
		origin = item(false);

		const emptied = poolsEmptiedAtEnd(endingEffect([emptyRule(['fury'])]));

		expect(emptied?.pools.map((each) => each.id)).toEqual(['actor:fury']);
	});

	it('has no holder for an effect on an item that is not embedded', () => {
		expect(poolsEmptiedAtEnd(endingEffect([emptyRule(['fury'])], item(false)))).toBeNull();
		expect(poolsEmptiedAtEnd(endingEffect([emptyRule(['fury'])], item(true)))?.holder).toBe(holder);
	});
});
