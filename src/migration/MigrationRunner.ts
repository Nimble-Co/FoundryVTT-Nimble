import { SYSTEM_ID } from '#system';
import localize from '../utils/localize.js';
import type { MigrationBase } from './MigrationBase.js';
import { MigrationRunnerBase } from './MigrationRunnerBase.js';
import {
	type MigrationPlan,
	type PlanError,
	type PlannedRoot,
	type PlanRoot,
	planMigration,
} from './planMigration.js';

type Json = Record<string, any>;

/** The part of the world the runner is writing, for the line under the bar. */
type RunPart = 'actors' | 'items' | 'tokens' | 'messages' | 'compendiums';

interface RunProgress {
	done: number;
	total: number;
	part: RunPart;
}

interface RunResult {
	plan: MigrationPlan;
	errors: PlanError[];
	written: number;
}

/** Extended CompendiumCollection interface with runtime properties */
interface CompendiumPack {
	documentName: string;
	documentClass: any;
	locked: boolean;
	metadata: { id: string; label: string; packageType: string };
	getDocuments(): Promise<foundry.abstract.Document.Any[]>;
	configure(options: { locked: boolean }): Promise<void>;
}

/** Where a planned root is written: its live document and the collection it is batched with. */
interface Target {
	document: any;
	part: RunPart;
	pack: CompendiumPack | null;
	/** An unlinked token's actor, with the delta it writes into. */
	delta?: { itemIds: Set<string>; effectIds: Set<string>; source: Json };
}

const BATCH = 50;

function rawSource(collection: Json[] | undefined, document: any): Json {
	const raw = collection?.find((entry) => entry._id === document.id);
	return foundry.utils.deepClone(raw ?? document.toObject());
}

function ownFields(source: Json): Json {
	const { items: _items, effects: _effects, ...own } = source;
	return own;
}

function liveIds(source: Json[] | undefined): string[] {
	return (source ?? []).filter((entry) => !entry._tombstone).map((entry) => entry._id);
}

class MigrationRunner extends MigrationRunnerBase {
	#targets = new Map<string, Target>();

	#errors: PlanError[] = [];

	override needsMigration(): boolean {
		return super.needsMigration(
			game.settings.get(
				SYSTEM_ID as 'core',
				'worldSchemaVersion' as 'rollMode',
			) as unknown as number,
		);
	}

	/** Every document the migrations can change, as raw sources, with where each one is written. */
	async collectRoots(): Promise<PlanRoot[]> {
		this.#targets.clear();
		const roots: PlanRoot[] = [];
		const add = (root: PlanRoot, target: Target) => {
			roots.push(root);
			this.#targets.set(root.uuid, target);
		};

		for (const actor of game.actors ?? []) {
			add(
				{
					kind: 'actor',
					uuid: actor.uuid,
					source: rawSource(game.data.actors as Json[], actor),
					holder: { kind: 'actor', actorName: actor.name ?? '', actorUuid: actor.uuid },
				},
				{ document: actor, part: 'actors', pack: null },
			);
		}

		for (const item of game.items ?? []) {
			add(
				{
					kind: 'item',
					uuid: item.uuid,
					source: rawSource(game.data.items as Json[], item),
					holder: { kind: 'sidebar' },
				},
				{ document: item, part: 'items', pack: null },
			);
		}

		for (const scene of game.scenes ?? []) {
			for (const token of scene.tokens) {
				const actor = token.actor;
				const delta = (token.delta as any)?._source as Json | undefined;
				const uuid = actor?.uuid;
				if (token.actorLink || !actor || !uuid || !delta) continue;
				const itemIds = liveIds(delta.items);
				const effectIds = liveIds(delta.effects);
				const ownKeys = Object.keys(ownFields(delta)).filter((key) => key !== '_id');
				if (itemIds.length === 0 && effectIds.length === 0 && ownKeys.length === 0) continue;
				add(
					{
						kind: 'actor',
						uuid,
						source: actor.toObject(),
						holder: {
							kind: 'token',
							actorName: actor.name ?? '',
							actorUuid: uuid,
							sceneName: scene.name ?? '',
						},
						delta: { itemIds, effectIds },
					},
					{
						document: actor,
						part: 'tokens',
						pack: null,
						delta: { itemIds: new Set(itemIds), effectIds: new Set(effectIds), source: delta },
					},
				);
			}
		}

		for (const message of game.messages ?? []) {
			add(
				{
					kind: 'message',
					uuid: message.uuid,
					source: rawSource(game.data.messages as Json[], message),
				},
				{ document: message, part: 'messages', pack: null },
			);
		}

		for (const pack of game.packs ?? []) {
			if (pack.metadata.packageType !== 'world') continue;
			if (!['Actor', 'Item'].includes(pack.documentName)) continue;
			const documents = await pack.getDocuments();
			for (const document of documents as any[]) {
				add(
					{
						kind: pack.documentName === 'Actor' ? 'actor' : 'item',
						uuid: document.uuid,
						source: document.toObject(),
						holder: {
							kind: 'compendium',
							packLabel: pack.metadata.label,
							...(pack.documentName === 'Actor'
								? { actorName: document.name ?? '', actorUuid: document.uuid }
								: {}),
						},
					},
					{ document, part: 'compendiums', pack: pack as unknown as CompendiumPack },
				);
			}
		}

		return roots;
	}

	/** The dry run: what the pending migrations change, with the GM's copies kept out. */
	async plan(excluded: ReadonlySet<string> = new Set()): Promise<MigrationPlan> {
		const roots = await this.collectRoots();
		return planMigration(roots, this.migrations, { excluded });
	}

	/** Writes a plan. The migrations' own `migrate` steps run after it. */
	async apply(
		plan: MigrationPlan,
		onProgress: (progress: RunProgress) => void = () => {},
	): Promise<RunResult> {
		this.#errors = [...plan.errors];
		const changed = plan.roots.filter(
			(entry) => entry.changed && this.#targets.has(entry.root.uuid),
		);
		const total = changed.length;
		let done = 0;

		const groups = new Map<string, PlannedRoot[]>();
		for (const entry of changed) {
			const target = this.#targets.get(entry.root.uuid)!;
			const key = `${target.part}|${target.pack?.metadata.id ?? ''}|${entry.root.kind}`;
			const group = groups.get(key) ?? [];
			group.push(entry);
			groups.set(key, group);
		}

		for (const group of groups.values()) {
			const target = this.#targets.get(group[0].root.uuid)!;
			const pack = target.pack;
			const wasLocked = pack?.locked ?? false;
			if (pack && wasLocked) await pack.configure({ locked: false });
			try {
				for (let start = 0; start < group.length; start += BATCH) {
					const batch = group.slice(start, start + BATCH);
					await this.#writeBatch(batch);
					done += batch.length;
					onProgress({ done, total, part: target.part });
				}
			} finally {
				if (pack && wasLocked) await pack.configure({ locked: true });
			}
		}

		for (const migration of this.migrations) {
			if (!migration.migrate) continue;
			try {
				await migration.migrate();
			} catch (error) {
				this.#writeError(null, error, migration);
			}
		}

		const last = this.migrations.at(-1);
		if (last) {
			await game.settings.set(
				SYSTEM_ID as 'core',
				'worldSchemaVersion' as 'rollMode',
				last.version as unknown as foundry.CONST.DICE_ROLL_MODES,
			);
		}

		return { plan, errors: this.#errors, written: done };
	}

	async #writeBatch(batch: PlannedRoot[]): Promise<void> {
		const first = this.#targets.get(batch[0].root.uuid)!;
		if (first.delta) {
			for (const entry of batch) await this.#writeToken(entry);
			return;
		}
		if (batch[0].root.kind === 'message') {
			for (const entry of batch) await this.#writeMessage(entry);
			return;
		}

		const updates: Json[] = [];
		for (const entry of batch) {
			const update = await this.#prepareDocument(entry);
			if (update) updates.push(update);
		}
		const documentClass = first.document.constructor;
		const pack = first.pack?.metadata.id ?? null;
		try {
			if (updates.length > 0) await documentClass.updateDocuments(updates, { noHook: true, pack });
		} catch (error) {
			for (const entry of batch) this.#writeError(entry.root, error);
			return;
		}
		for (const entry of batch) await this.#deleteItemEffects(entry);
	}

	/** Deletes the embedded documents the migrations removed, and returns the update of the rest. */
	async #prepareDocument(entry: PlannedRoot): Promise<Json | null> {
		const { document, pack } = this.#targets.get(entry.root.uuid)!;
		const before = entry.root.source;
		const after = foundry.utils.deepClone(entry.after);
		const operation = { noHook: true, pack: pack?.metadata.id ?? null };
		try {
			if (entry.root.kind === 'actor') {
				const items = this.diffCollection(before.items ?? [], after.items ?? []);
				const gone = items.deleted.filter((id) => document.items.has(id));
				if (gone.length > 0) await document.deleteEmbeddedDocuments('Item', gone, operation);
				after.items = [...items.inserted, ...items.updated];
			}
			const effects = this.diffCollection(before.effects ?? [], after.effects ?? []);
			const goneEffects = effects.deleted.filter((id) => document.effects.has(id));
			if (goneEffects.length > 0) {
				await document.deleteEmbeddedDocuments('ActiveEffect', goneEffects, operation);
			}
			after.effects = [...effects.inserted, ...effects.updated];
		} catch (error) {
			this.#writeError(entry.root, error);
			return null;
		}
		return after;
	}

	/** An update of an embedded item writes its effects, but deletes none of them. */
	async #deleteItemEffects(entry: PlannedRoot): Promise<void> {
		const { document, pack } = this.#targets.get(entry.root.uuid)!;
		const pairs: Array<[any, Json, Json]> =
			entry.root.kind === 'item'
				? []
				: (entry.after.items ?? []).map((item: Json) => [
						document.items.get(item._id),
						(entry.root.source.items ?? []).find((old: Json) => old._id === item._id),
						item,
					]);
		for (const [live, before, after] of pairs) {
			if (!live || !before) continue;
			const gone = this.diffCollection(before.effects ?? [], after.effects ?? []).deleted.filter(
				(id) => live.effects.has(id),
			);
			if (gone.length === 0) continue;
			try {
				await live.deleteEmbeddedDocuments('ActiveEffect', gone, {
					noHook: true,
					pack: pack?.metadata.id ?? null,
				});
			} catch (error) {
				this.#writeError(entry.root, error);
			}
		}
	}

	/** Writes only what the token's delta holds. The rest belongs to its base actor. */
	async #writeToken(entry: PlannedRoot): Promise<void> {
		const { document: actor, delta } = this.#targets.get(entry.root.uuid)!;
		if (!delta) return;
		const before = entry.root.source;
		const after = foundry.utils.deepClone(entry.after);
		const operation = { noHook: true };
		try {
			for (const [name, key, ids] of [
				['Item', 'items', delta.itemIds],
				['ActiveEffect', 'effects', delta.effectIds],
			] as const) {
				const diff = this.diffCollection(before[key] ?? [], after[key] ?? []);
				const gone = diff.deleted.filter((id) => ids.has(id));
				if (gone.length > 0) await actor.deleteEmbeddedDocuments(name, gone, operation);
				if (diff.inserted.length > 0) {
					await actor.createEmbeddedDocuments(name, diff.inserted, { ...operation, keepId: true });
				}
				const updated = diff.updated.filter((source) => ids.has(source._id));
				if (updated.length > 0) await actor.updateEmbeddedDocuments(name, updated, operation);
			}
			const own = foundry.utils.diffObject(ownFields(before), ownFields(after));
			const held = Object.fromEntries(
				Object.entries(foundry.utils.flattenObject(own)).filter(([path]) =>
					foundry.utils.hasProperty(delta.source, path),
				),
			);
			if (Object.keys(held).length > 0) await actor.update(held, operation);
		} catch (error) {
			this.#writeError(entry.root, error);
			return;
		}
		await this.#deleteItemEffects({
			...entry,
			after: {
				...after,
				items: (after.items ?? []).filter((item: Json) => delta.itemIds.has(item._id)),
			},
		});
	}

	async #writeMessage(entry: PlannedRoot): Promise<void> {
		const { document } = this.#targets.get(entry.root.uuid)!;
		const changes = foundry.utils.diffObject(entry.root.source, entry.after);
		if (Object.keys(changes).length === 0) return;
		try {
			await document.update(changes, { noHook: true });
		} catch (error) {
			this.#writeError(entry.root, error);
		}
	}

	#writeError(root: PlanRoot | null, error: unknown, migration?: MigrationBase): void {
		console.error(error);
		this.#errors.push({
			uuid: root?.uuid ?? '',
			name: root?.source?.name ?? migration?.title ?? '',
			version: migration?.version ?? null,
			message: error instanceof Error ? error.message : String(error),
		});
	}

	/** Plans and writes every pending migration, with no GM choice. */
	async runMigration(): Promise<RunResult> {
		ui.notifications.info(
			localize('NIMBLE.migration.world.starting', { version: game.system.version }),
		);
		const result = await this.apply(await this.plan());
		if (result.errors.length > 0) {
			console.warn('Nimble | Migration errors:', result.errors);
			ui.notifications.warn(
				localize('NIMBLE.migration.world.completedWithErrors', {
					count: result.errors.length.toString(),
				}),
			);
		} else {
			ui.notifications.info(localize('NIMBLE.migration.world.completed'));
		}
		return result;
	}
}

export { MigrationRunner };
export type { RunPart, RunProgress, RunResult };
