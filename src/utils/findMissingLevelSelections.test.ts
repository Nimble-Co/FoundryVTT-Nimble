import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	buildRealIndex,
	loadAllClasses,
	loadAllFeatureDocs,
	restoreMocks,
} from '../../tests/fixtures/classProgression.ts';
import type { HeldFeature } from './collectHeldPicks.ts';
import collectOptionPoolEntitlement, {
	type OptionPoolEntitlement,
} from './collectOptionPoolEntitlement.ts';
import collectSwappableOptions from './collectSwappableOptions.ts';
import findMissingLevelSelections, {
	type MissingLevelSelection,
} from './findMissingLevelSelections.ts';
import type { ClassFeatureIndex } from './getClassFeatures.ts';

/**
 * Drives the banner against the REAL compendium, so every granted count and every slot level
 * asserted here is the one the class data prints.
 */

let index: ClassFeatureIndex;

beforeAll(async () => {
	index = await buildRealIndex();
});

afterAll(() => {
	restoreMocks();
});

/** The bigger combat die, which the Commander's later levels grant outright as an alternative. */
const DIE = 'Compendium.nimble.nimble-class-features.Item.WnKpJ8RvCb4mX2Qt';
const DEV_DIE = 'Compendium.nimble-dev.nimble-class-features.Item.WnKpJ8RvCb4mX2Qt';

const COMMANDER_POOL = 'combat-tactics+commanders-orders';

/** The compendium uuid of the one feature with this name. */
function featureUuid(name: string): string {
	const doc = loadAllFeatureDocs().find((feature) => feature.name === name);
	if (!doc) throw new Error(`No compendium feature named ${name}`);
	return doc.uuid;
}

/** The uuids of every non-subclass member of a feature group, in compendium order. */
function poolMembers(group: string): string[] {
	return loadAllFeatureDocs()
		.filter((feature) => !feature.system.subclass && feature.system.group === group)
		.map((feature) => feature.uuid);
}

function heldFeature(id: string, compendiumSource: string): HeldFeature {
	return { id, compendiumSource };
}

/** A level 9 Commander who holds every pick their levels grant: two orders, a tactic, two dice. */
function commanderHoldings(): HeldFeature[] {
	return [
		heldFeature('item-face-me', featureUuid('Face Me!')),
		heldFeature('item-hold-the-line', featureUuid('Hold the Line!')),
		heldFeature('item-heavy-strike', featureUuid('Heavy Strike')),
		heldFeature('item-die-a', DIE),
		heldFeature('item-die-b', DIE),
		heldFeature('item-slashing', featureUuid('Slashing')),
	];
}

/** The same Commander after a die was deleted from the sheet by hand. */
function commanderHoldingsShortADie(): HeldFeature[] {
	return commanderHoldings().filter((feature) => feature.id !== 'item-die-b');
}

/** A Berserker at level 8 holding two of the three Savage Arsenal abilities their levels grant. */
function berserkerHoldings(): HeldFeature[] {
	const [first, second] = poolMembers('savage-arsenal');
	return [heldFeature('item-arsenal-a', first), heldFeature('item-arsenal-b', second)];
}

function findGap(gaps: MissingLevelSelection[], poolKey: string) {
	return gaps.find((gap) => gap.poolKey === poolKey);
}

describe('findMissingLevelSelections', () => {
	it('reports no gap for a level 9 Commander holding every pick their levels grant', async () => {
		const gaps = await findMissingLevelSelections(index, 'commander', 9, commanderHoldings(), []);

		expect(gaps).toEqual([]);
	});

	it('reports one missing pick in the merged pool when a die was deleted by hand', async () => {
		const gaps = await findMissingLevelSelections(
			index,
			'commander',
			9,
			commanderHoldingsShortADie(),
			[],
		);

		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toMatchObject({
			poolKey: COMMANDER_POOL,
			missingCount: 1,
			// Four holdings cover the two picks level 2 grants, the one level 4 grants and the one
			// level 6 grants, so level 8 is the earliest slot they run out on.
			level: 8,
		});
	});

	it('offers only the pool members the short Commander holds none of', async () => {
		const gaps = await findMissingLevelSelections(
			index,
			'commander',
			9,
			commanderHoldingsShortADie(),
			[],
		);

		expect(gaps[0].candidateUuids).toContain(featureUuid('Reposition!'));
		expect(gaps[0].candidateUuids).not.toContain(featureUuid('Face Me!'));
		// One die is still held, so the correction dialog does not offer a second one.
		expect(gaps[0].candidateUuids).not.toContain(DIE);
	});

	it('reports no gap for a Commander holding a hand-added third die', async () => {
		const holdings = [...commanderHoldings(), heldFeature('item-die-c', DIE)];

		expect(await findMissingLevelSelections(index, 'commander', 9, holdings, [])).toEqual([]);
	});

	it('counts a pick stored under the dev namespace as held', async () => {
		const holdings = [...commanderHoldingsShortADie(), heldFeature('item-die-dev', DEV_DIE)];

		expect(await findMissingLevelSelections(index, 'commander', 9, holdings, [])).toEqual([]);
	});

	it('reports the third Savage Arsenal ability a level 8 Berserker never took', async () => {
		const gaps = await findMissingLevelSelections(index, 'berserker', 8, berserkerHoldings(), []);

		expect(gaps).toHaveLength(1);
		// One ability at each of levels 4, 6 and 8, so two holdings run out at level 8.
		expect(gaps[0]).toMatchObject({
			poolKey: 'savage-arsenal',
			level: 8,
			missingCount: 1,
			optionLabel: 'Choose a Savage Arsenal Ability',
		});
	});

	it('reports nothing without a class', async () => {
		expect(await findMissingLevelSelections(index, '', 9, commanderHoldings(), [])).toEqual([]);
	});

	it('reports nothing below level 1', async () => {
		expect(await findMissingLevelSelections(index, 'commander', 0, [], [])).toEqual([]);
	});

	it('counts the same picks the rest window counts, from one fixture', async () => {
		const holdings = commanderHoldingsShortADie();

		const pools = await collectSwappableOptions(index, 'commander', 9, holdings, [], null);
		const gaps = await findMissingLevelSelections(index, 'commander', 9, holdings, []);

		const pool = pools.find((candidate) => candidate.poolKey === COMMANDER_POOL);
		expect(pool).toMatchObject({ heldCount: 4, grantedCount: 5 });
		expect(findGap(gaps, COMMANDER_POOL)?.missingCount).toBe(
			(pool?.grantedCount ?? 0) - (pool?.heldCount ?? 0),
		);
	});
});

/**
 * The banner sits on every character sheet, so a warning about a character that is fine is
 * worse than a gap it misses. Every core class, built to level 20 with exactly the picks its
 * levels grant, must come back clean.
 */
describe('findMissingLevelSelections, characters holding every pick their levels grant', () => {
	const CLASS_IDENTIFIERS = loadAllClasses().map((cls) => cls.identifier);

	/** One held feature per granted pick, cycling the members when a pool grants more than it lists. */
	function entitledHoldings(pool: OptionPoolEntitlement): HeldFeature[] {
		if (pool.candidateUuids.length === 0) return [];

		return Array.from({ length: pool.grantedCount }, (_unused, pick) =>
			heldFeature(
				`item-${pool.poolKey}-${pick}`,
				pool.candidateUuids[pick % pool.candidateUuids.length],
			),
		);
	}

	function describeGap(
		classIdentifier: string,
		gap: MissingLevelSelection,
		pools: OptionPoolEntitlement[],
		holdings: HeldFeature[],
	): string {
		const pool = pools.find((candidate) => candidate.poolKey === gap.poolKey);
		const held = holdings.filter((feature) => feature.id.startsWith(`item-${gap.poolKey}-`));
		return [
			`${classIdentifier} / ${gap.poolKey}: missing ${gap.missingCount} at level ${gap.level}`,
			`  grants ${pool?.grantedCount} from ${pool?.candidateUuids.length} members`,
			`  slots ${JSON.stringify(pool?.slots)}`,
			`  holds ${JSON.stringify(held.map((feature) => feature.compendiumSource))}`,
		].join('\n');
	}

	it('reports no gap for any core class at level 20 that holds every pick its levels grant', async () => {
		const failures: string[] = [];

		for (const classIdentifier of CLASS_IDENTIFIERS) {
			const pools = await collectOptionPoolEntitlement(index, classIdentifier, 20, null);
			const holdings = pools.flatMap(entitledHoldings);

			const gaps = await findMissingLevelSelections(index, classIdentifier, 20, holdings, []);
			for (const gap of gaps) failures.push(describeGap(classIdentifier, gap, pools, holdings));
		}

		expect(failures).toEqual([]);
	});

	it('reports one missing pick in the one pool a dropped feature leaves short', async () => {
		const failures: string[] = [];

		for (const classIdentifier of CLASS_IDENTIFIERS) {
			const pools = await collectOptionPoolEntitlement(index, classIdentifier, 20, null);

			for (const short of pools) {
				const holdings = pools.flatMap(entitledHoldings);
				const dropped = holdings.findLastIndex((feature) =>
					feature.id.startsWith(`item-${short.poolKey}-`),
				);
				if (dropped < 0) continue;
				holdings.splice(dropped, 1);

				const gaps = await findMissingLevelSelections(index, classIdentifier, 20, holdings, []);
				const reported = gaps.map((gap) => `${gap.poolKey} x${gap.missingCount}`);
				if (reported.join() === `${short.poolKey} x1`) continue;

				failures.push(
					[
						`${classIdentifier} / ${short.poolKey}: dropping one pick reported ${JSON.stringify(reported)}`,
						`  grants ${short.grantedCount} from ${short.candidateUuids.length} members`,
						`  slots ${JSON.stringify(short.slots)}`,
						`  holds ${JSON.stringify(
							holdings
								.filter((feature) => feature.id.startsWith(`item-${short.poolKey}-`))
								.map((feature) => feature.compendiumSource),
						)}`,
					].join('\n'),
				);
			}
		}

		expect(failures).toEqual([]);
	});
});
