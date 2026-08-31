import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
	buildRealIndex,
	getClassMeta,
	loadAllClasses,
	loadAllFeatureDocs,
	restoreMocks,
} from '../../tests/fixtures/classProgression.ts';
import findMissingLevelSelections from './findMissingLevelSelections.ts';
import getClassFeaturesFromIndex, { type ClassFeatureIndex } from './getClassFeatures.ts';
import isLevelUpOptionApplicable from './isLevelUpOptionApplicable.ts';

/**
 * Drives the audit against the REAL compendium, so a character built by the real resolver is
 * the baseline for "nothing is missing" and every gap is measured against actual class data.
 */

let index: ClassFeatureIndex;

beforeAll(async () => {
	index = await buildRealIndex();
});

afterAll(() => {
	restoreMocks();
});

/** Not-yet-owned members of a pool, the way an option picker would offer them. */
function poolMembers(groups: readonly string[], owned: ReadonlySet<string>): string[] {
	return loadAllFeatureDocs()
		.filter(
			(feature) =>
				!feature.system.subclass &&
				groups.includes(feature.system.group) &&
				!owned.has(feature.uuid),
		)
		.map((feature) => feature.uuid);
}

/**
 * The compendium-source uuids a correctly built character of `classIdentifier` holds at
 * `throughLevel` — every auto-grant, every selection group filled to its count, and every
 * unambiguous level-up option's pool picks taken.
 */
async function buildOwnedFeatureUuids(
	classIdentifier: string,
	throughLevel: number,
): Promise<Set<string>> {
	const meta = getClassMeta(classIdentifier);
	const owned = new Set<string>();

	for (let level = 1; level <= throughLevel; level++) {
		const offered = await getClassFeaturesFromIndex(
			index,
			classIdentifier,
			level,
			{ ownedFeatureUuids: owned },
			meta.groupIdentifiers,
		);

		for (const feature of offered.autoGrant) owned.add(feature.uuid ?? '');

		for (const group of offered.selectionGroups.values()) {
			for (let i = 0; i < group.selectionCount && i < group.features.length; i++) {
				owned.add(group.features[i].uuid ?? '');
			}
		}

		for (const feature of offered.optionFeatures) {
			owned.add(feature.uuid ?? '');

			const applicable = (feature.system.levelUpOptions ?? []).filter((option) =>
				isLevelUpOptionApplicable(option, level),
			);
			if (applicable.length !== 1) continue;

			const [option] = applicable;
			const groups = option.selectionGroups ?? [];
			if (groups.length === 0) continue;

			const pool = poolMembers(groups, owned);
			const count = option.selectionCount ?? 1;
			for (let i = 0; i < count && i < pool.length; i++) owned.add(pool[i]);
		}
	}

	return owned;
}

/** The sacred graces a character owns, in compendium order. */
function ownedSacredGraces(owned: ReadonlySet<string>): string[] {
	return loadAllFeatureDocs()
		.filter((feature) => feature.system.group === 'sacred-grace' && owned.has(feature.uuid))
		.map((feature) => feature.uuid);
}

async function auditShepherd(level: number, owned: ReadonlySet<string>) {
	return findMissingLevelSelections(index, 'shepherd', level, owned);
}

describe('findMissingLevelSelections', () => {
	it('reports nothing for a Shepherd who took both level-5 Sacred Graces', async () => {
		const owned = await buildOwnedFeatureUuids('shepherd', 5);

		expect(ownedSacredGraces(owned)).toHaveLength(2);
		expect(await auditShepherd(5, owned)).toEqual([]);
	});

	it('reports the second Sacred Grace for a Shepherd who reached level 5 with only one', async () => {
		const owned = await buildOwnedFeatureUuids('shepherd', 5);
		const graces = ownedSacredGraces(owned);
		const short = new Set(owned);
		short.delete(graces[0]);

		const gaps = await auditShepherd(5, short);

		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toMatchObject({
			level: 5,
			poolKey: 'sacred-grace',
			poolGroups: ['sacred-grace'],
			displayName: 'Sacred Graces',
			optionLabel: 'Choose 2 Sacred Graces',
			missingCount: 1,
		});
		expect(gaps[0].candidateUuids).toContain(graces[0]);
		expect(gaps[0].candidateUuids).not.toContain(graces[1]);
	});

	it('does not report a level the character has not reached', async () => {
		const owned = await buildOwnedFeatureUuids('shepherd', 4);

		expect(ownedSacredGraces(owned)).toHaveLength(0);
		expect(await auditShepherd(4, owned)).toEqual([]);
	});

	it('attributes a shortfall spanning several grace levels to level 5', async () => {
		const owned = await buildOwnedFeatureUuids('shepherd', 9);
		const graces = ownedSacredGraces(owned);
		const short = new Set(owned);
		for (const grace of graces.slice(1)) short.delete(grace);

		const gaps = await auditShepherd(9, short);

		expect(graces).toHaveLength(3);
		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toMatchObject({ level: 5, missingCount: 2 });
	});

	it('reports nothing for a Shepherd who took all four graces by level 13', async () => {
		const owned = await buildOwnedFeatureUuids('shepherd', 13);

		expect(ownedSacredGraces(owned)).toHaveLength(4);
		expect(await auditShepherd(13, owned)).toEqual([]);
	});

	/**
	 * A level offering more than one alternative records nothing about which the player took,
	 * so a missing pick there cannot be told apart from an alternative that needed no pick.
	 * The Commander's "Fit for Any Battlefield" offers a pool pick OR a flat combat die at
	 * levels 6+, and must never be reported.
	 */
	it('stays silent on a level whose level-up option had alternatives', async () => {
		const owned = await buildOwnedFeatureUuids('commander', 20);
		const tactics = poolMembers(['combat-tactics', 'commanders-orders'], new Set()).filter((uuid) =>
			owned.has(uuid),
		);
		const short = new Set(owned);
		for (const uuid of tactics.slice(1)) short.delete(uuid);

		const gaps = await findMissingLevelSelections(index, 'commander', 20, short);

		expect(gaps.filter((gap) => gap.level >= 6)).toEqual([]);
	});
});

/**
 * The warning this audit drives sits on every character sheet, so a false positive is worse
 * than a missed gap. A character each class built correctly to level 20 must come back clean.
 */
describe('findMissingLevelSelections — correctly built characters', () => {
	const CLASS_IDENTIFIERS = loadAllClasses().map((cls) => cls.identifier);

	for (const classIdentifier of CLASS_IDENTIFIERS) {
		it(`${classIdentifier} at level 20 reports no gaps`, async () => {
			const owned = await buildOwnedFeatureUuids(classIdentifier, 20);
			expect(await findMissingLevelSelections(index, classIdentifier, 20, owned)).toEqual([]);
		});
	}
});
