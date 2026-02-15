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
		applyFunc: createFeatureIndex,
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

		const indexTypes: string[] = [...pack.index]
			.map((i) => (i as object as { type?: string }).type)
			.filter(Boolean) as string[];
		if (!indexTypes.every((type) => indexTypes[0] === type)) return;

		const indexType = indexTypes[0];
		if (!indexType) return;

		const packConfig = PACK_DATA_CONFIG[indexType as keyof typeof PACK_DATA_CONFIG];
		if (!packConfig) return;

		const { applyFunc } = packConfig;
		if (!applyFunc) return;

		applyFunc(pack, {});
	});
}

type Pack = CompendiumCollection;

export function createAncestryIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description', 'system.exotic', 'system.size'],
	});
}

export function createBackgroundIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.category', 'system.description'],
	});
}

export function createBoonIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createClassIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.complexity', 'system.description'],
	});
}

export function createFeatureIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description', 'system.gainedAtLevel', 'system.gainedAtLevels'],
	});
}

export function createObjectIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createSpellIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}

export function createSubclassIndex(pack: Pack, _options: Record<string, any>) {
	pack.getIndex({
		fields: ['system.description'],
	});
}
