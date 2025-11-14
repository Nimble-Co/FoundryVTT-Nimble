/* eslint-disable @typescript-eslint/no-unused-vars */
const PACK_DATA_CONFIG = {
	background: {
		packs: ['nimble.nimble-backgrounds'],
		applyFunc: createBackgroundIndex,
	},
	boon: {
		packs: ['nimble.nimble-boons'],
		applyFunc: null,
	},
	class: {
		packs: ['nimble.nimble-classes'],
		applyFunc: createClassIndex,
	},
	feature: {
		packs: [],
		applyFunc: null,
	},
	object: {
		packs: [],
		applyFunc: null,
	},
	ancestry: {
		packs: ['nimble.nimble-ancestries'],
		applyFunc: createAncestryIndex,
	},
	spell: {
		packs: [],
		applyFunc: null,
	},
	subclass: {
		packs: [],
		applyFunc: null,
	},
} as const;

export function preparePackIndexes() {
	game.packs.forEach((pack) => {
		const id = pack.metadata.id || pack.collection;
		if (!id) return;

		const documentType = pack.metadata.type;
		if (!documentType) return;

		// @ts-expect-error
		const indexTypes: string[] = [...pack.index].map((i) => i.type).filter(Boolean);
		if (!indexTypes.every((type) => indexTypes[0] === type)) return;

		const indexType = indexTypes[0];
		if (!indexType) return;

		const { applyFunc } = PACK_DATA_CONFIG[indexType];
		if (!applyFunc) return;

		applyFunc(pack);
	});
}

// @ts-expect-error
type Pack = CompendiumCollection<CompendiumCollection.Metadata>;

export function createAncestryIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description', 'system.exotic', 'system.size'],
	});
}

export function createBackgroundIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.category', 'system.description'],
	});
}

export function createBoonIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createClassIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.complexity', 'system.description'],
	});
}

export function createFeatureIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createObjectIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createSpellIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createSubclassIndex(pack: any, options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}
