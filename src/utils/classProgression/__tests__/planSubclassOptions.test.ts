import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import planSubclassOptions, { type ChoiceFeature } from '../planSubclassOptions.ts';

const DIR = 'packs/classFeatures/core/hunter/hunter-subclasses/beastmaster';
const PACK = 'Compendium.nimble.nimble-class-features.Item.';

interface PackItem {
	_id: string;
	name: string;
	system: {
		identifier?: string;
		subclass?: boolean;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		levelUpOptions?: Array<{
			id: string;
			applyAtLevels?: number[];
			rules?: Array<{ type?: string; uuid?: string }>;
			releases?: { group: string; count: number };
		}>;
	};
}

function loadItems(): PackItem[] {
	return readdirSync(DIR)
		.filter((name) => name.endsWith('.json'))
		.map((name) => JSON.parse(readFileSync(resolve(DIR, name), 'utf8')) as PackItem);
}

function asFeature(item: PackItem): ChoiceFeature & { name: string } {
	return {
		name: item.name,
		uuid: `${PACK}${item._id}`,
		system: item.system,
	};
}

function levelsOf(item: PackItem): number[] {
	return [...new Set([item.system.gainedAtLevel, ...(item.system.gainedAtLevels ?? [])])].filter(
		(level): level is number => typeof level === 'number',
	);
}

const items = loadItems();
const features = items.map(asFeature);
const beastmaster = features.find((feature) => feature.name === 'Beastmaster');
const atLevel = (level: number) =>
	features.filter((feature) => {
		const item = items.find((candidate) => candidate.name === feature.name);
		return item ? levelsOf(item).includes(level) : false;
	});

function grantsOf(optionId: string): string[] {
	const option = beastmaster?.system?.levelUpOptions?.find(
		(candidate) => candidate.id === optionId,
	);
	return (option?.rules ?? []).flatMap((rule) =>
		typeof rule.uuid === 'string' ? [rule.uuid] : [],
	);
}

function namesFor(uuids: string[]): string[] {
	return uuids
		.map((uuid) => features.find((feature) => feature.uuid === uuid)?.name)
		.filter((name): name is string => Boolean(name))
		.sort();
}

/** Owned Thrill of the Hunt picks and the history entries that granted them. */
function thrillPicks(...picks: Array<[string, number]>) {
	return {
		owned: picks.map(([id]) => ({
			id,
			uuid: `Actor.hunter.Item.${id}`,
			system: { group: 'thrill-of-the-hunt' },
			_stats: { compendiumSource: `${PACK}${id}` },
		})),
		history: picks.map(([id, level]) => ({ level, grantedFeatureIds: [id] })),
	};
}

describe('Beastmaster companion choice', () => {
	it('offers the size choice when the subclass is taken, and does not auto-grant every size', () => {
		const plan = planSubclassOptions({
			incoming: atLevel(3),
			owned: [],
			level: 3,
			optionIds: [],
			history: [],
		});

		expect(plan.optionFeatures.map((feature) => feature.name)).toEqual(['Beastmaster']);
		expect(plan.autoGrant.map((feature) => feature.name)).toEqual([]);
		expect(plan.release).toEqual([]);
		for (const option of beastmaster?.system?.levelUpOptions ?? []) {
			expect(option.applyAtLevels).toEqual([3]);
		}
	});

	it.each([
		['small', ['Small - Keen Eyes']],
		['medium', ['Medium - Ferocious']],
		['large', ['Large - Alpha Protector']],
	])('%s grants only that size, and leaves the Thrill of the Hunt picks', (optionId, names) => {
		expect(namesFor(grantsOf(optionId))).toEqual(names);
		const plan = planSubclassOptions({
			incoming: atLevel(3),
			level: 3,
			optionIds: [optionId],
			...thrillPicks(['shot', 2], ['trap', 2]),
		});
		expect(plan.release).toEqual([]);
	});

	it.each([
		['small-swap', ['Small - Go for the Throat!', 'Small - Keen Eyes', 'Small - Protect Me!']],
		['medium-swap', ['Medium - Ferocious', 'Medium - Go for the Throat!', 'Medium - Protect Me!']],
		[
			'large-swap',
			['Large - Alpha Protector', 'Large - Go for the Throat!', 'Large - Protect Me!'],
		],
	])(
		'%s grants that size and releases the first two Thrill of the Hunt picks',
		(optionId, names) => {
			expect(namesFor(grantsOf(optionId))).toEqual(names);
			expect(
				beastmaster?.system?.levelUpOptions?.find((option) => option.id === optionId)?.releases,
			).toEqual({ group: 'thrill-of-the-hunt', count: 2 });
			const plan = planSubclassOptions({
				incoming: atLevel(3),
				level: 3,
				optionIds: ['other', optionId],
				...thrillPicks(['later', 4], ['second', 2], ['first', 2]),
			});
			expect(plan.release).toEqual([
				{ id: 'first', uuid: `${PACK}first`, level: 2 },
				{ id: 'second', uuid: `${PACK}second`, level: 2 },
			]);
		},
	);

	it('does not grant Medium or Large features before level 3', () => {
		for (const optionId of ['medium', 'medium-swap', 'large', 'large-swap']) {
			for (const uuid of grantsOf(optionId)) {
				const item = items.find((candidate) => `${PACK}${candidate._id}` === uuid);
				expect(item?.system.gainedAtLevel ?? 0).toBeGreaterThanOrEqual(3);
			}
		}
	});

	it('does not add the other sizes at a later level once the choice is on the sheet', () => {
		const plan = planSubclassOptions({
			incoming: atLevel(7),
			owned: beastmaster ? [beastmaster] : [],
			level: 7,
			optionIds: [],
			history: [],
		});

		expect(plan.optionFeatures).toEqual([]);
		expect(plan.autoGrant).toEqual([]);
	});

	it('still auto-grants a subclass feature the choice does not grant', () => {
		const other: ChoiceFeature & { name: string } = {
			name: 'Skilled Tracker',
			uuid: `${PACK}tracker`,
			system: { subclass: true },
		};
		const plan = planSubclassOptions({
			incoming: [...atLevel(3), other],
			owned: [],
			level: 3,
			optionIds: [],
			history: [],
		});

		expect(plan.autoGrant.map((feature) => feature.name)).toEqual(['Skilled Tracker']);
	});
});

describe('planSubclassOptions releases', () => {
	const swap: ChoiceFeature = {
		uuid: `${PACK}choice`,
		system: {
			subclass: true,
			levelUpOptions: [
				{ id: 'keep', applyAtLevels: [3], rules: [] },
				{ id: 'trade', applyAtLevels: [3], rules: [], releases: { group: 'tricks', count: 1 } },
			],
		},
	};
	const owned = [
		{ id: 'old', system: { group: 'tricks' }, _stats: { compendiumSource: `${PACK}old` } },
		{ id: 'new', system: { group: 'tricks' }, _stats: { compendiumSource: `${PACK}new` } },
		{ id: 'other', system: { group: 'spells' } },
	];
	const history = [
		{ level: 2, grantedFeatureIds: ['old'] },
		{ level: 5, grantedFeatureIds: ['new'] },
	];

	it('releases the earliest picks of the group the chosen option names', () => {
		const plan = planSubclassOptions({
			incoming: [swap],
			owned,
			level: 3,
			optionIds: ['trade'],
			history,
		});
		expect(plan.release).toEqual([{ id: 'old', uuid: `${PACK}old`, level: 2 }]);
	});

	it('releases nothing for an option that names no group', () => {
		const plan = planSubclassOptions({
			incoming: [swap],
			owned,
			level: 3,
			optionIds: ['keep'],
			history,
		});
		expect(plan.release).toEqual([]);
	});

	it('keeps a pick with no compendium source, with an empty uuid', () => {
		const plan = planSubclassOptions({
			incoming: [swap],
			owned: [{ id: 'homebrew', system: { group: 'tricks' } }],
			level: 3,
			optionIds: ['trade'],
			history: [{ level: 2, grantedFeatureIds: ['homebrew'] }],
		});
		expect(plan.release).toEqual([{ id: 'homebrew', uuid: '', level: 2 }]);
	});
});
