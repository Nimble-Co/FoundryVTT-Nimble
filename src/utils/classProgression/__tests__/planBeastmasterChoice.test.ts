import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import planBeastmasterChoice, { type ChoiceFeature } from '../planBeastmasterChoice.ts';

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

describe('Beastmaster companion choice', () => {
	it('offers the size choice when the subclass is taken, and does not auto-grant every size', () => {
		const plan = planBeastmasterChoice({
			incoming: atLevel(3),
			owned: [],
			level: 3,
			optionId: null,
			thrillPicks: [],
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
		const plan = planBeastmasterChoice({
			incoming: atLevel(3),
			owned: [],
			level: 3,
			optionId,
			thrillPicks: [
				{ id: 'shot', level: 2 },
				{ id: 'trap', level: 2 },
			],
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
			const plan = planBeastmasterChoice({
				incoming: atLevel(3),
				owned: [],
				level: 3,
				optionId,
				thrillPicks: [
					{ id: 'later', level: 4 },
					{ id: 'second', level: 2 },
					{ id: 'first', level: 2 },
				],
			});
			expect(plan.release.map((pick) => pick.id)).toEqual(['first', 'second']);
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
		const plan = planBeastmasterChoice({
			incoming: atLevel(7),
			owned: beastmaster ? [beastmaster] : [],
			level: 7,
			optionId: null,
			thrillPicks: [],
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
		const plan = planBeastmasterChoice({
			incoming: [...atLevel(3), other],
			owned: [],
			level: 3,
			optionId: null,
			thrillPicks: [],
		});

		expect(plan.autoGrant.map((feature) => feature.name)).toEqual(['Skilled Tracker']);
	});
});
