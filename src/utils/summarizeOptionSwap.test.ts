import { describe, expect, it } from 'vitest';

import type { ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import summarizeOptionSwap from './summarizeOptionSwap.ts';

function pool(overrides: Partial<ResolvedSwappableOptionPool> = {}): ResolvedSwappableOptionPool {
	return {
		poolKey: 'savage-arsenal',
		poolGroups: ['savage-arsenal'],
		displayName: 'Savage Arsenal',
		optionLabel: 'Choose a Savage Arsenal Ability',
		levels: [4, 6],
		pickCount: 2,
		candidateUuids: ['uuid:rampage', 'uuid:whirlwind', 'uuid:death-blow'],
		ownedUuids: ['uuid:rampage', 'uuid:whirlwind'],
		itemIdByUuid: new Map(),
		candidates: [
			{ uuid: 'uuid:rampage', name: 'Rampage' },
			{ uuid: 'uuid:whirlwind', name: 'Whirlwind' },
			{ uuid: 'uuid:death-blow', name: 'Death Blow' },
		] as ResolvedSwappableOptionPool['candidates'],
		...overrides,
	};
}

describe('summarizeOptionSwap', () => {
	it('reports nothing for an unchanged pool', () => {
		const changes = summarizeOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:whirlwind']]]),
		);

		expect(changes).toEqual([]);
	});

	it('reports nothing for a pool the player did not open', () => {
		expect(summarizeOptionSwap([pool()], new Map())).toEqual([]);
	});

	it('names what was dropped and what was taken', () => {
		const changes = summarizeOptionSwap(
			[pool()],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
		);

		expect(changes).toEqual([
			{ label: 'Savage Arsenal', removed: ['Whirlwind'], added: ['Death Blow'] },
		]);
	});

	it('falls back to the uuid when a candidate has no name', () => {
		const changes = summarizeOptionSwap(
			[pool({ candidates: [] as ResolvedSwappableOptionPool['candidates'] })],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
		);

		expect(changes[0].added).toEqual(['uuid:death-blow']);
	});

	it('falls back to the option label when the pool has no display name', () => {
		const changes = summarizeOptionSwap(
			[pool({ displayName: null })],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
		);

		expect(changes[0].label).toBe('Choose a Savage Arsenal Ability');
	});

	it('reports both halves of a skill point move', () => {
		const changes = summarizeOptionSwap(
			[],
			new Map(),
			new Map([
				['stealth', { from: 3, to: 2 }],
				['arcana', { from: 1, to: 2 }],
			]),
			(key) => key.charAt(0).toUpperCase() + key.slice(1),
		);

		expect(changes).toEqual([
			{ label: 'Stealth', removed: ['Stealth 3 to 2'], added: [] },
			{ label: 'Arcana', removed: [], added: ['Arcana 1 to 2'] },
		]);
	});

	it('ignores a skill whose total did not move', () => {
		const changes = summarizeOptionSwap([], new Map(), new Map([['stealth', { from: 3, to: 3 }]]));

		expect(changes).toEqual([]);
	});
});
