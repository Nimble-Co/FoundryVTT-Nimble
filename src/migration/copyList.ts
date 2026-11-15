import type { MigrationKind } from './MigrationBase.js';
import type { Holder, PlannedCopy } from './planMigration.js';

type CopySort = 'item' | 'actor';

type TitleIndex = ReadonlyMap<number, { title: string; kind: MigrationKind }>;

interface CopyTitle {
	title: string;
	/** A structure change: it runs on a copy the GM keeps out, too. */
	always: boolean;
}

/** One line of the list: a copy, or the same copy on several tokens of one actor in one scene. */
interface CopyRow {
	key: string;
	uuids: string[];
	/** The document the runner writes for each copy, in the order of `uuids`. */
	rootUuids: string[];
	name: string;
	img: string | null;
	holder: Holder;
	titles: CopyTitle[];
	excludable: boolean;
	matchedByName: boolean;
	isActor: boolean;
}

interface CopyGroup {
	key: string;
	kind: Holder['kind'] | 'item';
	name: string;
	img: string | null;
	sceneName?: string;
	packLabel?: string;
	/** The tokens a token group covers. */
	tokens?: number;
	count: number;
	rows: CopyRow[];
	/** The copies a box on the group keeps out or puts back. */
	uuids: string[];
}

type CheckState = 'on' | 'off' | 'mixed' | 'none';

const HOLDER_ORDER: Record<string, number> = { actor: 0, token: 1, sidebar: 2, compendium: 3 };

function itemKey(copy: PlannedCopy): string {
	return copy.sourceId ?? `${copy.documentName}|${copy.type}|${copy.name.trim().toLowerCase()}`;
}

function holderKey(holder: Holder): string {
	switch (holder.kind) {
		case 'actor':
			return `actor|${holder.actorUuid}`;
		case 'token':
			return `token|${holder.sceneName}|${holder.actorName}`;
		case 'compendium':
			return `compendium|${holder.packLabel}`;
		default:
			return 'sidebar';
	}
}

function titlesOf(copy: PlannedCopy, titles: TitleIndex): CopyTitle[] {
	return copy.versions.map((version) => {
		const entry = titles.get(version);
		return { title: entry?.title ?? String(version), always: entry?.kind !== 'content' };
	});
}

/** The copies, one row each, with the same copy on tokens of one actor in one scene merged. */
function rowsOf(copies: PlannedCopy[], titles: TitleIndex): CopyRow[] {
	const rows = new Map<string, CopyRow>();
	for (const copy of copies) {
		const key =
			copy.holder.kind === 'token' ? `${holderKey(copy.holder)}|${itemKey(copy)}` : copy.uuid;
		const row = rows.get(key);
		if (row) {
			row.uuids.push(copy.uuid);
			row.rootUuids.push(copy.rootUuid);
			continue;
		}
		rows.set(key, {
			key,
			uuids: [copy.uuid],
			rootUuids: [copy.rootUuid],
			name: copy.name,
			img: copy.img,
			holder: copy.holder,
			titles: titlesOf(copy, titles),
			excludable: copy.excludable,
			matchedByName: copy.matchedByName,
			isActor: copy.documentName === 'Actor',
		});
	}
	return [...rows.values()];
}

function group(
	key: string,
	rows: CopyRow[],
	base: Omit<CopyGroup, 'key' | 'count' | 'rows' | 'uuids'>,
) {
	return {
		key,
		...base,
		rows,
		count: rows.reduce((sum, row) => sum + row.uuids.length, 0),
		uuids: rows.filter((row) => row.excludable).flatMap((row) => row.uuids),
	};
}

function byName(a: CopyGroup, b: CopyGroup): number {
	return a.name.localeCompare(b.name);
}

/** The listed Compendium Copies, sorted By Item or By Actor. */
function copyGroups(copies: PlannedCopy[], sort: CopySort, titles: TitleIndex): CopyGroup[] {
	const buckets = new Map<string, CopyRow[]>();
	const firstOf = new Map<string, CopyRow>();
	for (const row of rowsOf(copies, titles)) {
		const copy = copies.find((entry) => entry.uuid === row.uuids[0])!;
		const key = sort === 'item' ? itemKey(copy) : holderKey(row.holder);
		const rows = buckets.get(key) ?? [];
		rows.push(row);
		buckets.set(key, rows);
		if (!firstOf.has(key)) firstOf.set(key, row);
	}

	const groups = [...buckets].map(([key, rows]) => {
		const first = firstOf.get(key)!;
		if (sort === 'item')
			return group(key, rows, { kind: 'item', name: first.name, img: first.img });
		const holder = first.holder;
		const actorRow = rows.find((row) => row.isActor);
		return group(key, rows, {
			kind: holder.kind,
			name: holder.actorName ?? '',
			img: actorRow?.img ?? null,
			sceneName: holder.sceneName,
			packLabel: holder.packLabel,
			tokens:
				holder.kind === 'token' ? Math.max(...rows.map((row) => row.uuids.length)) : undefined,
		});
	});

	if (sort === 'item') return groups.sort(byName);
	return groups.sort(
		(a, b) =>
			HOLDER_ORDER[a.kind] - HOLDER_ORDER[b.kind] ||
			(a.packLabel ?? '').localeCompare(b.packLabel ?? '') ||
			byName(a, b),
	);
}

/** The box of a row or a group: whether its copies migrate. */
function checkState(target: CopyRow | CopyGroup, excluded: ReadonlySet<string>): CheckState {
	const uuids = 'rows' in target ? target.uuids : target.excludable ? target.uuids : [];
	if (uuids.length === 0) return 'none';
	const out = uuids.filter((uuid) => excluded.has(uuid)).length;
	if (out === 0) return 'on';
	return out === uuids.length ? 'off' : 'mixed';
}

/** Puts the copies back when all of them are kept out; keeps all of them out otherwise. */
function toggleCopies(excluded: ReadonlySet<string>, uuids: string[]): Set<string> {
	const next = new Set(excluded);
	const allOut = uuids.every((uuid) => next.has(uuid));
	for (const uuid of uuids) {
		if (allOut) next.delete(uuid);
		else next.add(uuid);
	}
	return next;
}

export { checkState, copyGroups, toggleCopies };
export type { CheckState, CopyGroup, CopyRow, CopySort, CopyTitle, TitleIndex };
