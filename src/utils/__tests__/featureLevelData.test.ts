import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

type PackSource = {
	_id?: string;
	name: string;
	type: string;
	system?: {
		class?: string;
		group?: string;
		subclass?: boolean;
		gainedAtLevel?: number | null;
		gainedAtLevels?: number[];
		rules?: unknown[];
		levelUpOptions?: { rules?: unknown[] }[];
	};
};

const COMPENDIUM_ITEM_UUID = /^Compendium\.[^.]+\.[^.]+\.Item\.(?<id>[A-Za-z0-9]+)$/;

function readPackSources(): { file: string; source: PackSource }[] {
	return globSync('packs/**/*.json', { cwd: process.cwd() })
		.filter((file) => !file.endsWith('ids.json'))
		.map((file) => {
			const raw = readFileSync(path.resolve(process.cwd(), file), 'utf-8');
			return { file, source: JSON.parse(raw) as PackSource };
		});
}

/** Every rule on an item, including those nested under its level-up options. */
function collectRules(source: PackSource): Record<string, unknown>[] {
	const own = Array.isArray(source.system?.rules) ? source.system.rules : [];
	const fromOptions = (source.system?.levelUpOptions ?? []).flatMap((option) =>
		Array.isArray(option?.rules) ? option.rules : [],
	);
	return [...own, ...fromOptions].filter(
		(rule): rule is Record<string, unknown> => !!rule && typeof rule === 'object',
	);
}

/** Ids named by item uuids on the given rules. */
function idsNamedBy(rules: Record<string, unknown>[]): Set<string> {
	const granted = new Set<string>();
	for (const rule of rules) {
		for (const value of Object.values(rule)) {
			if (typeof value !== 'string') continue;
			const id = COMPENDIUM_ITEM_UUID.exec(value)?.groups?.id;
			if (id) granted.add(id);
		}
	}
	return granted;
}

/**
 * Ids of items that some other item's rule hands out (`grantItem.uuid`,
 * `poolMaxBonus.grantItemUuid`, and anything else naming an item uuid).
 */
function collectGrantedItemIds(sources: { source: PackSource }[]): Set<string> {
	const granted = new Set<string>();
	for (const { source } of sources) {
		for (const id of idsNamedBy(collectRules(source))) granted.add(id);
	}
	return granted;
}

/** Ids handed out by a rule that is not inside a level-up option. */
function collectTopLevelGrantedItemIds(sources: { source: PackSource }[]): Set<string> {
	const granted = new Set<string>();
	for (const { source } of sources) {
		const own = Array.isArray(source.system?.rules) ? source.system.rules : [];
		const rules = own.filter(
			(rule): rule is Record<string, unknown> => !!rule && typeof rule === 'object',
		);
		for (const id of idsNamedBy(rules)) granted.add(id);
	}
	return granted;
}

function hasLevelData(source: PackSource): boolean {
	const { gainedAtLevel, gainedAtLevels } = source.system ?? {};
	if (gainedAtLevel !== null && gainedAtLevel !== undefined) return true;
	return Array.isArray(gainedAtLevels) && gainedAtLevels.length > 0;
}

function describeItem({ file, source }: { file: string; source: PackSource }): string {
	return `${source.name} (${file})`;
}

/**
 * Level data is what makes a feature grantable, so which items carry it is a
 * correctness question rather than a completeness one.
 *
 * `getClassFeaturesFromIndex` indexes features by level, then auto-grants the
 * ones in a `-progression` group and offers the rest as selections within their
 * group. A feature that another feature already hands out through a rule must
 * therefore carry no level data: with it, the class progression would surface a
 * second copy at that level alongside the granted one. A feature that nothing
 * grants must carry it, or levelling never hands it out at all.
 *
 * This replaces a runtime `console.warn` on the features tab, which fired on
 * every sort for cards that legitimately have no level, including class and
 * subclass cards whose data models have no such field.
 */
describe('feature pack level data', () => {
	const sources = readPackSources();
	const features = sources.filter(({ source }) => source.type === 'feature');
	const grantedItemIds = collectGrantedItemIds(sources);
	const topLevelGrantedItemIds = collectTopLevelGrantedItemIds(sources);

	it('reads a non-empty set of feature items', () => {
		expect(features.length).toBeGreaterThan(0);
	});

	it('finds items granted by another feature rule', () => {
		// Guards the derivation itself: if uuid parsing broke, every feature would
		// look ungranted and the next assertion would pass for the wrong reason.
		expect(grantedItemIds.size).toBeGreaterThan(0);
	});

	it('records a level on every feature that levelling has to grant', () => {
		const missing = features
			.filter(({ source }) => !hasLevelData(source))
			.filter(({ source }) => !(source._id && grantedItemIds.has(source._id)))
			.map(describeItem);

		expect(missing).toEqual([]);
	});

	it('leaves a level off every feature another rule already grants', () => {
		// A subclass feature keeps its level so the subclass list can still show it.
		// When the only grant is a level-up option, planBeastmasterChoice keeps that
		// uuid off the auto-grant list, so the level is not a second copy.
		const overSpecified = features
			.filter(({ source }) => source._id && grantedItemIds.has(source._id))
			.filter(({ source }) => hasLevelData(source))
			.filter(({ source }) => {
				if (
					source.system?.subclass === true &&
					source._id &&
					!topLevelGrantedItemIds.has(source._id)
				) {
					return false;
				}
				return true;
			})
			.map(describeItem);

		expect(overSpecified).toEqual([]);
	});

	it('agrees between the two level fields when both are set', () => {
		// `gainedAtLevel` is the primary; the sheet falls back to the minimum of
		// the list. A primary above that minimum would badge the card one level
		// and sort it at another.
		const inconsistent = features
			.filter(({ source }) => {
				const { gainedAtLevel, gainedAtLevels } = source.system ?? {};
				if (gainedAtLevel === null || gainedAtLevel === undefined) return false;
				if (!Array.isArray(gainedAtLevels) || gainedAtLevels.length < 1) return false;
				return gainedAtLevel !== Math.min(...gainedAtLevels);
			})
			.map(describeItem);

		expect(inconsistent).toEqual([]);
	});
});
