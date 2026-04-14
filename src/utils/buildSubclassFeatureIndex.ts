import type {
	FeaturePackEntry,
	SubclassFeatureIndex,
	SubclassFeatureIndexEntry,
} from '#types/subclassFeatures.d.ts';

const FEATURE_INDEX_FIELDS = [
	'system.class',
	'system.subclass',
	'system.gainedAtLevel',
	'system.gainedAtLevels',
	'system.group',
] as const;

function addToIndex(
	index: SubclassFeatureIndex,
	classId: string,
	subclassId: string,
	level: number,
	entry: SubclassFeatureIndexEntry,
): void {
	if (!index.has(classId)) index.set(classId, new Map());
	const classMap = index.get(classId)!;
	if (!classMap.has(subclassId)) classMap.set(subclassId, new Map());
	const subclassMap = classMap.get(subclassId)!;
	if (!subclassMap.has(level)) subclassMap.set(level, []);
	const levelArray = subclassMap.get(level)!;
	if (!levelArray.some((e) => e.uuid === entry.uuid)) levelArray.push(entry);
}

function indexFeature(
	index: SubclassFeatureIndex,
	uuid: string,
	system: FeaturePackEntry['system'],
): void {
	if (!system?.subclass || !system.class || !system.group) return;
	const entry: SubclassFeatureIndexEntry = { uuid };
	if (system.gainedAtLevel) {
		addToIndex(index, system.class, system.group, system.gainedAtLevel, entry);
	}
	if (system.gainedAtLevels) {
		for (const level of system.gainedAtLevels) {
			addToIndex(index, system.class, system.group, level, entry);
		}
	}
}

export default async function buildSubclassFeatureIndex(): Promise<SubclassFeatureIndex> {
	const index: SubclassFeatureIndex = new Map();

	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		indexFeature(index, item.uuid, (item as FeaturePackEntry).system);
	}

	const packIndexes = await Promise.all(
		[...game.packs]
			.filter((pack) => pack.documentName === 'Item')
			// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
			.map((pack) => pack.getIndex({ fields: FEATURE_INDEX_FIELDS as unknown as string[] })),
	);

	for (const packIndex of packIndexes) {
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as FeaturePackEntry;
			if (packEntry.type !== 'feature') continue;
			indexFeature(index, packEntry.uuid, packEntry.system);
		}
	}

	return index;
}
