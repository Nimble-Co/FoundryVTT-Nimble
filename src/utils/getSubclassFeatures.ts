import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { SubclassFeatureIndex } from '#types/subclassFeatures.d.ts';

export default async function getSubclassFeaturesFromIndex(
	index: SubclassFeatureIndex,
	classIdentifier: string,
	subclassIdentifier: string,
	level: number,
): Promise<NimbleFeatureItem[]> {
	if (!classIdentifier || !subclassIdentifier || level < 1) return [];

	const entries = index.get(classIdentifier)?.get(subclassIdentifier)?.get(level) ?? [];
	if (entries.length === 0) return [];

	const features = await Promise.all(
		entries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	return features.filter((feature): feature is NimbleFeatureItem => feature !== null);
}
