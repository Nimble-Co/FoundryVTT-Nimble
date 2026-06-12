/**
 * Derives the localized import-preview summary from a parsed player character
 * export. Pure data-in/data-out so the derivation rules (item grouping, level
 * tags, max HP) can be unit tested without the dialog.
 */

import localize from '#utils/localize.ts';

export interface ParsedActorItem {
	name?: string;
	type?: string;
	img?: string;
	system?: Record<string, unknown>;
}

export interface ParsedActor {
	name?: string;
	type?: string;
	img?: string;
	system?: Record<string, unknown>;
	items?: ParsedActorItem[];
	/** v13 exports record their source system here. */
	_stats?: { exportSource?: { systemId?: string } | null };
	/** Pre-v13 exports recorded it under flags instead. */
	flags?: { exportSource?: { system?: string } } & Record<string, unknown>;
}

export interface ImportPreviewItem {
	name: string;
	level: number | null;
}

export interface ImportPreviewGroup {
	type: string;
	label: string;
	items: ImportPreviewItem[];
}

export interface ImportPreview {
	name: string;
	img: string | null;
	typeLabel: string;
	level: number | null;
	hpMax: number | null;
	ancestry: string | null;
	className: string | null;
	itemGroups: ImportPreviewGroup[];
	totalItems: number;
}

/** Display order for grouped item types in the preview. */
const ITEM_TYPE_ORDER = [
	'ancestry',
	'background',
	'class',
	'subclass',
	'feature',
	'spell',
	'object',
	'boon',
	'monsterFeature',
];

/** Sort rank for item types not listed in ITEM_TYPE_ORDER (sorts them last). */
const UNKNOWN_TYPE_RANK = ITEM_TYPE_ORDER.length;

/**
 * The class level at which an item was gained, if recorded. Features record
 * either a single `gainedAtLevel` or a `gainedAtLevels` array (multi-level
 * features); for the latter the earliest level is shown.
 */
function itemLevel(item: ParsedActorItem | undefined): number | null {
	const system = item?.system as { gainedAtLevel?: unknown; gainedAtLevels?: unknown } | undefined;

	const single = system?.gainedAtLevel;
	if (typeof single === 'number' && single > 0) return single;

	const multi = system?.gainedAtLevels;
	if (Array.isArray(multi)) {
		const levels = multi.filter((level): level is number => typeof level === 'number' && level > 0);
		if (levels.length > 0) return Math.min(...levels);
	}

	return null;
}

/**
 * Compute the character's derived max HP from class hit-die data.
 *
 * Mirrors the runtime derivation (see `character.ts#_prepareHitPoints` and
 * `class.ts`): `hp.max` is never stored, so reading it from the export yields
 * 0. Each class contributes `startingHpByHitDieSize[size] + sum(hpData)`, plus
 * the actor's flat `hp.bonus`.
 */
function deriveMaxHp(data: ParsedActor, classItems: ParsedActorItem[]): number | null {
	if (classItems.length === 0) return null;

	const startingByDie =
		(CONFIG.NIMBLE as { startingHpByHitDieSize?: Record<number, number> }).startingHpByHitDieSize ??
		{};
	const attributes = data.system?.attributes as { hp?: { bonus?: number } } | undefined;
	const bonus = attributes?.hp?.bonus ?? 0;

	return classItems.reduce((total, item) => {
		const system = (item.system ?? {}) as { hitDieSize?: number; hpData?: number[] };
		const starting = system.hitDieSize !== undefined ? (startingByDie[system.hitDieSize] ?? 0) : 0;
		const fromLevels = Array.isArray(system.hpData)
			? system.hpData.reduce((acc, value) => acc + (value || 0), 0)
			: 0;
		return total + starting + fromLevels;
	}, bonus);
}

/** Structured, localized summary of the character that would be imported. */
export default function buildImportPreview(data: ParsedActor): ImportPreview {
	const { json } = CONFIG.NIMBLE.actorImport;
	const items = Array.isArray(data.items) ? data.items : [];

	// Single pass: group items for display and pick out the entries the
	// headline (ancestry, class) and HP derivation need.
	const groups = new Map<string, ImportPreviewItem[]>();
	const classItems: ParsedActorItem[] = [];
	let ancestry: string | null = null;
	let className: string | null = null;

	for (const item of items) {
		const type = item?.type ?? 'base';
		if (!groups.has(type)) groups.set(type, []);
		groups.get(type)!.push({
			name: item?.name?.trim() || localize(json.unnamedItem),
			level: itemLevel(item),
		});

		if (type === 'ancestry') ancestry ??= item?.name ?? null;
		if (type === 'class') {
			className ??= item?.name ?? null;
			classItems.push(item!);
		}
	}

	const typeRank = (type: string): number => {
		const index = ITEM_TYPE_ORDER.indexOf(type);
		return index < 0 ? UNKNOWN_TYPE_RANK : index;
	};

	const itemGroups: ImportPreviewGroup[] = [...groups.entries()]
		.sort(([a], [b]) => typeRank(a) - typeRank(b))
		.map(([type, groupItems]) => ({
			type,
			label: localize(`TYPES.Item.${type}`),
			items: groupItems,
		}));

	const classData = data.system?.classData as { levels?: unknown } | undefined;
	const levels = classData?.levels;

	return {
		name: data.name?.trim() || localize(json.unnamed),
		img: data.img ?? null,
		typeLabel: localize(`TYPES.Actor.${data.type ?? 'character'}`),
		level: Array.isArray(levels) ? levels.length : null,
		hpMax: deriveMaxHp(data, classItems),
		ancestry,
		className,
		itemGroups,
		totalItems: items.length,
	};
}
