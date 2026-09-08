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
		pickIdsByUuid: new Map([
			['uuid:rampage', ['item-rampage']],
			['uuid:whirlwind', ['item-whirlwind']],
		]),
		repeatableUuids: [],
		candidates: [
			{ uuid: 'uuid:rampage', name: 'Rampage' },
			{ uuid: 'uuid:whirlwind', name: 'Whirlwind' },
			{ uuid: 'uuid:death-blow', name: 'Death Blow' },
		] as ResolvedSwappableOptionPool['candidates'],
		...overrides,
	};
}

function diePool(
	overrides: Partial<ResolvedSwappableOptionPool> = {},
): ResolvedSwappableOptionPool {
	return pool({
		poolKey: 'combat-tactics',
		poolGroups: ['combat-tactics'],
		displayName: 'Fit for Any Battlefield',
		levels: [4, 6, 8],
		pickCount: 3,
		candidateUuids: ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:die'],
		pickIdsByUuid: new Map([
			['uuid:tactic-a', ['item-tactic-a']],
			['uuid:die', ['item-die-6', 'item-die-8']],
		]),
		repeatableUuids: ['uuid:die'],
		candidates: [
			{ uuid: 'uuid:tactic-a', name: 'Heavy Strike' },
			{ uuid: 'uuid:tactic-b', name: 'Sweeping Strike' },
			{ uuid: 'uuid:die', name: '+1 Max Combat Die' },
		] as ResolvedSwappableOptionPool['candidates'],
		...overrides,
	});
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

	it('names one copy of a repeated option without a count', () => {
		const changes = summarizeOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:die', 'uuid:tactic-b']]]),
		);

		expect(changes).toEqual([
			{
				label: 'Fit for Any Battlefield',
				removed: ['+1 Max Combat Die'],
				added: ['Sweeping Strike'],
			},
		]);
	});

	it('names an option that moved more than once with its count', () => {
		const changes = summarizeOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:tactic-b']]]),
		);

		expect(changes).toEqual([
			{
				label: 'Fit for Any Battlefield',
				removed: ['+1 Max Combat Die x2'],
				added: ['Sweeping Strike x2'],
			},
		]);
	});

	it('falls back to the uuid when a candidate has no name', () => {
		const changes = summarizeOptionSwap(
			[pool({ candidates: [] as ResolvedSwappableOptionPool['candidates'] })],
			new Map([['savage-arsenal', ['uuid:rampage', 'uuid:death-blow']]]),
		);

		expect(changes[0].added).toEqual(['uuid:death-blow']);
	});

	it('reports nothing for a selection with fewer picks than the character holds', () => {
		const changes = summarizeOptionSwap([pool()], new Map([['savage-arsenal', ['uuid:rampage']]]));

		expect(changes).toEqual([]);
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

	it('keeps the count off the skill point lines', () => {
		const changes = summarizeOptionSwap(
			[diePool()],
			new Map([['combat-tactics', ['uuid:tactic-a', 'uuid:tactic-b', 'uuid:tactic-b']]]),
			new Map([['stealth', { from: 3, to: 1 }]]),
			(key) => key,
		);

		expect(changes[1]).toEqual({ label: 'stealth', removed: ['stealth 3 to 1'], added: [] });
	});

	it('ignores a skill whose total did not move', () => {
		const changes = summarizeOptionSwap([], new Map(), new Map([['stealth', { from: 3, to: 3 }]]));

		expect(changes).toEqual([]);
	});
});
