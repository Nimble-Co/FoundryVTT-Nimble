import { isCompendiumId } from './compendiumSourceId.js';
import type { MigrationBase, MigrationContext } from './MigrationBase.js';

/** Where a document lives, as the World Migration window names it. */
interface Holder {
	kind: 'actor' | 'token' | 'sidebar' | 'compendium';
	actorName?: string;
	actorUuid?: string;
	sceneName?: string;
	packLabel?: string;
}

/** A document the runner migrates as a whole, with its embedded documents. */
interface PlanRoot {
	kind: 'actor' | 'item' | 'message';
	uuid: string;
	source: any;
	holder?: Holder;
	/** An unlinked token's actor: the items and effects its delta holds. The rest is its base actor's. */
	delta?: { itemIds: string[]; effectIds: string[] };
}

interface PlannedRoot {
	root: PlanRoot;
	after: any;
	changed: boolean;
	/** The migrations that changed the document or one of its items. */
	versions: number[];
}

/** A Compendium Copy that the pending migrations change. */
interface PlannedCopy {
	uuid: string;
	rootUuid: string;
	documentName: 'Actor' | 'Item';
	name: string;
	img: string | null;
	type: string;
	sourceId: string | null;
	matchedByName: boolean;
	versions: number[];
	excludable: boolean;
	holder: Holder;
}

interface PlanError {
	uuid: string;
	name: string;
	/** The migration that threw. A failed write has none. */
	version: number | null;
	message: string;
}

interface MigrationPlan {
	roots: PlannedRoot[];
	copies: PlannedCopy[];
	errors: PlanError[];
}

interface PlanOptions {
	/** The uuids of the Compendium Copies the GM keeps out of content migrations. */
	excluded?: ReadonlySet<string>;
}

/** The kept-out documents of a root as they were before a content migration's own hooks. */
interface KeptOut {
	self: Json | null;
	items: Map<string, Json>;
	itemOrder: string[];
}

type Json = Record<string, any>;

interface Changes {
	versions: Set<number>;
	content: boolean;
}

const SELF = '';

function sourceIdOf(source: Json): string | null {
	return source?._stats?.compendiumSource ?? source?.flags?.core?.sourceId ?? null;
}

function ownJson(source: Json): string {
	const { items: _items, ...own } = source;
	return JSON.stringify(own);
}

function itemsOf(source: Json): Json[] {
	return Array.isArray(source.items) ? source.items : [];
}

class RootRun {
	readonly changes = new Map<string, Changes>();

	readonly data: Json;

	readonly context: MigrationContext;

	readonly errors: PlanError[] = [];

	constructor(
		readonly root: PlanRoot,
		readonly excluded: ReadonlySet<string>,
	) {
		this.data = foundry.utils.deepClone(root.source);
		this.context = { uuid: root.uuid };
	}

	async step(migration: MigrationBase): Promise<void> {
		const before = this.#snapshot();
		await this.#alwaysHooks(migration);
		const kept = migration.kind === 'content' ? this.#keepOut() : null;
		const known =
			migration.kind === 'content' && this.root.kind === 'actor'
				? new Set(itemsOf(this.data).map((item) => item._id))
				: null;
		if (this.root.kind === 'actor') await this.#actorHooks(migration);
		else if (this.root.kind === 'item') await this.#itemHooks(migration, this.data, undefined);
		else {
			await this.#guard(migration, this.data, this.root.uuid, () =>
				migration.updateMessage?.(this.data, this.context),
			);
		}
		if (kept) this.#restore(kept);
		if (known) this.#dropExcludedAdditions(known);
		this.#record(migration, before);
	}

	/** An item that a content migration adds stays out when the GM keeps its row out. */
	#dropExcludedAdditions(known: ReadonlySet<string>): void {
		const items = itemsOf(this.data);
		const kept = items.filter(
			(item) => known.has(item._id) || !this.excluded.has(this.#itemUuid(item._id)),
		);
		if (kept.length !== items.length) this.data.items = kept;
	}

	async #alwaysHooks(migration: MigrationBase): Promise<void> {
		if (this.root.kind === 'message') return;
		const items = this.root.kind === 'actor' ? itemsOf(this.data) : [this.data];
		const parent = this.root.kind === 'actor' ? this.data : undefined;
		for (const item of items) {
			await this.#guard(migration, item, this.#uuidOf(item), () =>
				migration.alwaysUpdateItem?.(item, parent, this.context),
			);
		}
		for (const effect of this.data.effects ?? []) {
			await this.#guard(migration, this.data, this.root.uuid, () =>
				migration.alwaysUpdateEffect?.(effect, this.data, this.context),
			);
		}
	}

	#uuidOf(document: Json): string {
		return document === this.data ? this.root.uuid : this.#itemUuid(document._id);
	}

	async #guard(
		migration: MigrationBase,
		document: Json,
		uuid: string,
		hook: () => Promise<void> | undefined,
	): Promise<void> {
		try {
			await hook();
		} catch (error) {
			this.errors.push({
				uuid,
				name: document?.name ?? '',
				version: migration.version,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	#itemUuid(id: string): string {
		return `${this.root.uuid}.Item.${id}`;
	}

	#keepOut(): KeptOut | null {
		if (this.root.kind === 'message') return null;
		const selfOut = this.excluded.has(this.root.uuid);
		const items = new Map<string, Json>();
		const itemOrder: string[] = [];
		if (this.root.kind === 'actor') {
			for (const item of itemsOf(this.data)) {
				itemOrder.push(item._id);
				if (selfOut || this.excluded.has(this.#itemUuid(item._id))) {
					items.set(item._id, foundry.utils.deepClone(item));
				}
			}
		}
		if (!selfOut && items.size === 0) return null;
		const self = selfOut ? foundry.utils.deepClone(this.data) : null;
		return { self, items, itemOrder };
	}

	#restore(kept: KeptOut): void {
		if (this.root.kind === 'item') {
			if (kept.self) this.#replace(this.data, kept.self);
			return;
		}
		const current = new Map(itemsOf(this.data).map((item) => [item._id, item]));
		const restored = (id: string) =>
			this.excluded.has(this.#itemUuid(id))
				? kept.items.get(id)
				: (current.get(id) ?? kept.items.get(id));
		let items: Json[];
		if (kept.self) {
			items = kept.itemOrder.map(restored).filter((item): item is Json => !!item);
			this.#replace(this.data, kept.self);
		} else {
			items = itemsOf(this.data).map((item) => kept.items.get(item._id) ?? item);
			for (const [id, item] of kept.items) if (!current.has(id)) items.push(item);
		}
		this.data.items = items;
	}

	#replace(target: Json, source: Json): void {
		for (const key of Object.keys(target)) delete target[key];
		Object.assign(target, source);
	}

	async #actorHooks(migration: MigrationBase): Promise<void> {
		const actor = this.data;
		await this.#guard(migration, actor, this.root.uuid, () =>
			migration.updateActor?.(actor, this.context),
		);
		for (const item of itemsOf(actor)) {
			await this.#guard(migration, item, this.#itemUuid(item._id), () =>
				migration.updateItem?.(item, actor, this.context),
			);
		}
		for (const effect of actor.effects ?? []) {
			await this.#guard(migration, actor, this.root.uuid, () =>
				migration.updateEffect?.(effect, actor, this.context),
			);
		}
	}

	async #itemHooks(migration: MigrationBase, item: Json, parent: Json | undefined): Promise<void> {
		await this.#guard(migration, item, this.root.uuid, () =>
			migration.updateItem?.(item, parent, this.context),
		);
		for (const effect of item.effects ?? []) {
			await this.#guard(migration, item, this.root.uuid, () =>
				migration.updateEffect?.(effect, item, this.context),
			);
		}
	}

	#snapshot(): Map<string, string> {
		const snapshot = new Map<string, string>([[SELF, ownJson(this.data)]]);
		if (this.root.kind === 'actor') {
			for (const item of itemsOf(this.data)) snapshot.set(item._id, JSON.stringify(item));
		}
		return snapshot;
	}

	#record(migration: MigrationBase, before: Map<string, string>): void {
		const mark = (key: string) => {
			const entry = this.changes.get(key) ?? { versions: new Set<number>(), content: false };
			entry.versions.add(migration.version);
			if (migration.kind === 'content') entry.content = true;
			this.changes.set(key, entry);
		};
		if (ownJson(this.data) !== before.get(SELF)) mark(SELF);
		if (this.root.kind !== 'actor') return;
		for (const item of itemsOf(this.data)) {
			if (JSON.stringify(item) !== before.get(item._id)) mark(item._id);
		}
	}
}

function listedCopy(
	run: RootRun,
	key: string,
	document: Json,
	documentName: 'Actor' | 'Item',
): PlannedCopy | null {
	const changes = run.changes.get(key);
	if (!changes) return null;
	if (documentName === 'Actor' && document.type === 'character') return null;
	const sourceId = sourceIdOf(document);
	const matchedByName = !isCompendiumId(sourceId ?? undefined);
	if (matchedByName && !changes.content) return null;
	return {
		uuid: key === SELF ? run.root.uuid : `${run.root.uuid}.Item.${key}`,
		rootUuid: run.root.uuid,
		documentName,
		name: document.name ?? '',
		img: document.img ?? null,
		type: document.type ?? '',
		sourceId,
		matchedByName,
		versions: [...changes.versions].sort((a, b) => a - b),
		excludable: changes.content,
		holder: run.root.holder ?? { kind: 'sidebar' },
	};
}

function copiesOf(run: RootRun): PlannedCopy[] {
	if (run.root.kind === 'message') return [];
	const copies: PlannedCopy[] = [];
	const documentName = run.root.kind === 'actor' ? 'Actor' : 'Item';
	const delta = run.root.delta;
	const self = delta ? null : listedCopy(run, SELF, run.data, documentName);
	if (self) copies.push(self);
	if (run.root.kind === 'actor') {
		for (const item of itemsOf(run.data)) {
			if (delta && !delta.itemIds.includes(item._id)) continue;
			const copy = listedCopy(run, item._id, item, 'Item');
			if (copy) copies.push(copy);
		}
	}
	return copies;
}

/**
 * Runs the pending migrations on copies of the world's documents and writes nothing. Returns each
 * document as the migrations leave it, and the Compendium Copies they change.
 */
async function planMigration(
	roots: PlanRoot[],
	migrations: MigrationBase[],
	options: PlanOptions = {},
): Promise<MigrationPlan> {
	const excluded = options.excluded ?? new Set<string>();
	const plan: MigrationPlan = { roots: [], copies: [], errors: [] };
	for (const root of roots) {
		const run = new RootRun(root, excluded);
		for (const migration of migrations) await run.step(migration);
		const versions = new Set([...run.changes.values()].flatMap((entry) => [...entry.versions]));
		plan.roots.push({
			root,
			after: run.data,
			changed: versions.size > 0,
			versions: [...versions].sort((a, b) => a - b),
		});
		plan.copies.push(...copiesOf(run));
		plan.errors.push(...run.errors);
	}
	return plan;
}

export { planMigration };
export type { Holder, MigrationPlan, PlanError, PlannedCopy, PlannedRoot, PlanOptions, PlanRoot };
