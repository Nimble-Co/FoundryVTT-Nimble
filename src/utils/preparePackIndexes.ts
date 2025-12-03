// Foundry supports dotted path notation for getIndex fields (e.g., 'system.description'),
// but the TypeScript definitions only allow top-level keys. This type provides a workaround.
type GetIndexOptions =
	foundry.documents.collections.CompendiumCollection.GetIndexOptions<'Item'> & {
		fields?: string[];
	};

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

export function createAncestryIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description', 'system.exotic', 'system.size'],
	} as GetIndexOptions);
}

export function createBackgroundIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.category', 'system.description'],
	} as GetIndexOptions);
}

export function createBoonIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description'],
	} as GetIndexOptions);
}

export function createClassIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.complexity', 'system.description'],
	} as GetIndexOptions);
}

export function createFeatureIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description'],
	} as GetIndexOptions);
}

export function createObjectIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description'],
	} as GetIndexOptions);
}

export function createSpellIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description'],
	} as GetIndexOptions);
}

export function createSubclassIndex(
	pack: CompendiumCollection<'Item'>,
	_options?: Record<string, unknown>,
) {
	pack.getIndex({
		fields: ['system.description'],
	} as GetIndexOptions);
}
