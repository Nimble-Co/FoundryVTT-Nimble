import { SYSTEM_ID } from '#system';
import localize from '../utils/localize.js';

/**
 * The dev rolling release installs as system id `nimble-dev` (see
 * `build/dev-rebrand.mjs`). Foundry namespaces flags and settings by the
 * installed system id at write time, so any world or document that was created
 * (or whose flags were written) under the stable `nimble` system has its data
 * keyed under `flags.nimble.*` and `nimble.*` settings keys — invisible to code
 * that reads via `SYSTEM_ID` after the dev install takes over.
 *
 * **Why init, not ready:** running on `ready` is too late. Foundry calls
 * `prepareData` on every document during `Game.initializeDocuments` (which
 * happens between `init` and `setup`). Any code path in `prepareDerivedData`
 * that calls `this.getFlag(SYSTEM_ID, ...)` throws on a document whose
 * persisted flags still have a stale `flags.nimble.*` key, because Foundry's
 * `getFlag` validates the document's own flag scopes against installed
 * packages and rejects unknown scopes (the legacy `'nimble'` package is not
 * installed under the dev build).
 *
 * Two phases:
 *
 *   1. `init` (registered before the main init handler) — runs before document
 *      instantiation. Walks the raw `game.data.*` arrays and rewrites
 *      `flags.nimble.*` → `flags.nimble-dev.*` in memory. After this, when
 *      Foundry constructs documents from the data, they see only the
 *      dev-keyed flags. Settings storage is rebranded here too. This makes
 *      the *current session* work without `getFlag` throws.
 *
 *      Confirmation dialog runs here too: world initialization is paused on
 *      the modal until the user accepts. If they cancel, the rebrand is
 *      skipped for this session (legacy keys remain in memory, which means
 *      `getFlag` will throw — there's nothing we can do about that, but the
 *      user explicitly chose this path).
 *
 *   2. `ready` — once documents exist as full instances, persist the rebrand
 *      to the database via `Document#update`. This phase is asynchronous and
 *      doesn't block the user from interacting; toasts notify when done.
 *
 * Per project decision the originals are *deleted* after the copy (the dev
 * install is the source of truth from that point onward; the stable install
 * cannot read the rebranded data without its own migration).
 *
 * No-op on the stable install (early-return on SYSTEM_ID check). No-op on
 * already-rebranded worlds (legacy data detection short-circuits as soon as
 * nothing remains under `flags.nimble.*` or `nimble.*` settings).
 */

const STABLE_SYSTEM_ID = 'nimble';
const DEV_SYSTEM_ID = 'nimble-dev';

interface RebrandStats {
	actors: number;
	items: number;
	scenes: number;
	tokens: number;
	tokenActorDeltas: number;
	journals: number;
	macros: number;
	tables: number;
	combats: number;
	combatants: number;
	users: number;
	chatMessages: number;
	embeddedItems: number;
	embeddedEffects: number;
	settings: number;
}

function emptyStats(): RebrandStats {
	return {
		actors: 0,
		items: 0,
		scenes: 0,
		tokens: 0,
		tokenActorDeltas: 0,
		journals: 0,
		macros: 0,
		tables: 0,
		combats: 0,
		combatants: 0,
		users: 0,
		chatMessages: 0,
		embeddedItems: 0,
		embeddedEffects: 0,
		settings: 0,
	};
}

function statsSummary(stats: RebrandStats): string {
	const counted = Object.entries(stats)
		.filter(([, count]) => count > 0)
		.map(([label, count]) => `${label}=${count}`)
		.join(', ');
	return counted || 'no documents had legacy flags';
}

interface FlagBearing {
	flags?: Record<string, unknown> | null;
}

function hasLegacyFlags(source: FlagBearing | null | undefined): boolean {
	if (!source?.flags || typeof source.flags !== 'object') return false;
	const legacy = (source.flags as Record<string, unknown>)[STABLE_SYSTEM_ID];
	return legacy != null && typeof legacy === 'object' && !Array.isArray(legacy);
}

/**
 * Mutate a raw source object in place: copy `flags.nimble` into
 * `flags.nimble-dev` (merging with anything already there, dev side wins), and
 * delete the `flags.nimble` key. Returns true if something changed.
 */
function rebrandSourceInPlace(source: FlagBearing): boolean {
	if (!hasLegacyFlags(source)) return false;

	const flags = source.flags as Record<string, unknown>;
	const legacyData = flags[STABLE_SYSTEM_ID] as Record<string, unknown>;
	const existingDevData = flags[DEV_SYSTEM_ID];
	const merged =
		existingDevData != null &&
		typeof existingDevData === 'object' &&
		!Array.isArray(existingDevData)
			? foundry.utils.mergeObject(
					foundry.utils.deepClone(legacyData),
					foundry.utils.deepClone(existingDevData as Record<string, unknown>),
					{ inplace: false, overwrite: true },
				)
			: foundry.utils.deepClone(legacyData);

	flags[DEV_SYSTEM_ID] = merged;
	delete flags[STABLE_SYSTEM_ID];
	return true;
}

function rebrandIfNeeded(
	source: FlagBearing | null | undefined,
	stats: RebrandStats,
	statKey: keyof RebrandStats,
): boolean {
	if (!source) return false;
	if (!rebrandSourceInPlace(source)) return false;
	stats[statKey] += 1;
	return true;
}

// ---------------------------------------------------------------------------
// Phase 1: in-memory rebrand on preInitGame.
// ---------------------------------------------------------------------------

interface RawWorldData {
	actors?: RawActor[];
	items?: RawItem[];
	scenes?: RawScene[];
	journal?: FlagBearing[];
	macros?: FlagBearing[];
	tables?: FlagBearing[];
	combats?: RawCombat[];
	users?: FlagBearing[];
	messages?: FlagBearing[];
}

interface RawActor extends FlagBearing {
	items?: FlagBearing[];
	effects?: FlagBearing[];
}

interface RawItem extends FlagBearing {
	effects?: FlagBearing[];
}

interface RawScene extends FlagBearing {
	tokens?: RawToken[];
}

interface RawToken extends FlagBearing {
	delta?: FlagBearing | null;
}

interface RawCombat extends FlagBearing {
	combatants?: FlagBearing[];
}

function rebrandInMemory(stats: RebrandStats): void {
	const data = (game as unknown as { data?: RawWorldData }).data;
	if (!data) return;

	for (const actor of data.actors ?? []) {
		rebrandIfNeeded(actor, stats, 'actors');
		for (const item of actor.items ?? []) {
			rebrandIfNeeded(item, stats, 'embeddedItems');
		}
		for (const effect of actor.effects ?? []) {
			rebrandIfNeeded(effect, stats, 'embeddedEffects');
		}
	}

	for (const item of data.items ?? []) {
		rebrandIfNeeded(item, stats, 'items');
		for (const effect of item.effects ?? []) {
			rebrandIfNeeded(effect, stats, 'embeddedEffects');
		}
	}

	for (const scene of data.scenes ?? []) {
		rebrandIfNeeded(scene, stats, 'scenes');
		for (const token of scene.tokens ?? []) {
			rebrandIfNeeded(token, stats, 'tokens');
			if (token.delta) {
				rebrandIfNeeded(token.delta, stats, 'tokenActorDeltas');
			}
		}
	}

	for (const journal of data.journal ?? []) rebrandIfNeeded(journal, stats, 'journals');
	for (const macro of data.macros ?? []) rebrandIfNeeded(macro, stats, 'macros');
	for (const table of data.tables ?? []) rebrandIfNeeded(table, stats, 'tables');
	for (const combat of data.combats ?? []) {
		rebrandIfNeeded(combat, stats, 'combats');
		for (const combatant of combat.combatants ?? []) {
			rebrandIfNeeded(combatant, stats, 'combatants');
		}
	}
	for (const user of data.users ?? []) rebrandIfNeeded(user, stats, 'users');
	for (const message of data.messages ?? []) rebrandIfNeeded(message, stats, 'chatMessages');
}

// ---------------------------------------------------------------------------
// Settings rebrand.
// ---------------------------------------------------------------------------

interface RawSetting {
	_id?: string;
	key?: string;
	value?: unknown;
}

/**
 * Settings live in `game.settings.storage.get('world')`. At preInitGame the
 * settings collection is already populated from the server payload. We rewrite
 * keys here so any subsequent `game.settings.get(SYSTEM_ID as 'core', ...)`
 * call during `init` or later sees the dev-keyed value.
 *
 * The persistent DB write happens in phase 2.
 */
function rebrandSettingsInMemory(stats: RebrandStats): RawSetting[] {
	const storage = game.settings?.storage?.get('world') as { contents?: RawSetting[] } | undefined;
	if (!storage?.contents) return [];

	const legacy: RawSetting[] = [];
	for (const setting of [...storage.contents]) {
		const key = setting.key;
		if (typeof key !== 'string' || !key.startsWith(`${STABLE_SYSTEM_ID}.`)) continue;
		legacy.push(setting);

		const settingName = key.slice(STABLE_SYSTEM_ID.length + 1);
		const devKey = `${DEV_SYSTEM_ID}.${settingName}`;

		// In-memory rewrite: mutate the key on the existing doc. The doc instance
		// stays in the collection so settings reads still find it; only the key
		// changes. Skip if a doc already exists at the dev key (user already
		// configured it under the dev install).
		const existingDev = storage.contents.find((s) => s.key === devKey);
		if (!existingDev) {
			setting.key = devKey;
		}
		stats.settings += 1;
	}
	return legacy;
}

// ---------------------------------------------------------------------------
// Phase 2: persistent rebrand on ready.
// ---------------------------------------------------------------------------

/**
 * Build the update payload that copies `flags.nimble` → `flags.nimble-dev`
 * (merging) and deletes `flags.nimble` from the persisted document. We use
 * the document's CURRENT (already in-memory rebranded) flags as the source of
 * truth for the dev-side data, and only target the `flags.nimble` deletion plus
 * the dev-side reinforcement. Returns null if nothing to persist.
 */
function buildPersistentUpdate(
	source: FlagBearing,
	legacyKeyPresent: boolean,
): Record<string, unknown> | null {
	if (!legacyKeyPresent) return null;
	const flags = (source.flags ?? {}) as Record<string, unknown>;
	const devData = flags[DEV_SYSTEM_ID];
	return {
		[`flags.${DEV_SYSTEM_ID}`]: devData ?? {},
		[`flags.${STABLE_SYSTEM_ID}`]: new foundry.data.operators.ForcedDeletion(),
	};
}

interface DocumentLike {
	uuid?: string;
	flags?: Record<string, unknown> | null;
	update(data: object, options?: object): Promise<unknown>;
}

async function persistDocument(
	doc: DocumentLike | null | undefined,
	rawSourceHadLegacy: boolean,
): Promise<void> {
	if (!doc || !rawSourceHadLegacy) return;
	const update = buildPersistentUpdate(doc as FlagBearing, true);
	if (!update) return;
	await doc.update(update, { noHook: true }).catch((err: unknown) => {
		console.error(`Nimble | dev-rebrand: failed to persist update on ${doc.uuid}:`, err);
	});
}

/**
 * Map of `<documentName>:<id>` → true for each raw source that had a legacy
 * key before phase 1 rewrote it. Phase 2 reads this to know which documents
 * actually need a DB write. Built during phase 1 (before mutation).
 */
type LegacyRegistry = Set<string>;

function recordLegacy(
	registry: LegacyRegistry,
	documentName: string,
	source: { _id?: string } & FlagBearing,
): void {
	if (hasLegacyFlags(source) && source._id) {
		registry.add(`${documentName}:${source._id}`);
	}
}

function buildLegacyRegistry(): LegacyRegistry {
	const registry: LegacyRegistry = new Set();
	const data = (game as unknown as { data?: RawWorldData }).data;
	if (!data) return registry;

	for (const actor of data.actors ?? []) {
		recordLegacy(registry, 'Actor', actor as { _id?: string } & FlagBearing);
		for (const item of actor.items ?? []) {
			recordLegacy(registry, 'Item', item as { _id?: string } & FlagBearing);
		}
		for (const effect of actor.effects ?? []) {
			recordLegacy(registry, 'ActiveEffect', effect as { _id?: string } & FlagBearing);
		}
	}
	for (const item of data.items ?? []) {
		recordLegacy(registry, 'Item', item as { _id?: string } & FlagBearing);
		for (const effect of item.effects ?? []) {
			recordLegacy(registry, 'ActiveEffect', effect as { _id?: string } & FlagBearing);
		}
	}
	for (const scene of data.scenes ?? []) {
		recordLegacy(registry, 'Scene', scene as { _id?: string } & FlagBearing);
		for (const token of scene.tokens ?? []) {
			recordLegacy(registry, 'Token', token as { _id?: string } & FlagBearing);
		}
	}
	for (const journal of data.journal ?? []) {
		recordLegacy(registry, 'JournalEntry', journal as { _id?: string } & FlagBearing);
	}
	for (const macro of data.macros ?? []) {
		recordLegacy(registry, 'Macro', macro as { _id?: string } & FlagBearing);
	}
	for (const table of data.tables ?? []) {
		recordLegacy(registry, 'RollTable', table as { _id?: string } & FlagBearing);
	}
	for (const combat of data.combats ?? []) {
		recordLegacy(registry, 'Combat', combat as { _id?: string } & FlagBearing);
		for (const combatant of combat.combatants ?? []) {
			recordLegacy(registry, 'Combatant', combatant as { _id?: string } & FlagBearing);
		}
	}
	for (const user of data.users ?? []) {
		recordLegacy(registry, 'User', user as { _id?: string } & FlagBearing);
	}
	for (const message of data.messages ?? []) {
		recordLegacy(registry, 'ChatMessage', message as { _id?: string } & FlagBearing);
	}
	return registry;
}

async function persistRebrand(
	legacyRegistry: LegacyRegistry,
	legacySettings: RawSetting[],
): Promise<void> {
	if (!game.user?.isGM) return;

	const had = (documentName: string, id: string | null | undefined): boolean =>
		!!id && legacyRegistry.has(`${documentName}:${id}`);

	for (const actor of game.actors ?? []) {
		await persistDocument(actor as unknown as DocumentLike, had('Actor', actor.id));
		for (const item of actor.items) {
			await persistDocument(item as unknown as DocumentLike, had('Item', item.id));
		}
		for (const effect of actor.effects) {
			await persistDocument(effect as unknown as DocumentLike, had('ActiveEffect', effect.id));
		}
	}

	for (const item of game.items ?? []) {
		await persistDocument(item as unknown as DocumentLike, had('Item', item.id));
		for (const effect of item.effects) {
			await persistDocument(effect as unknown as DocumentLike, had('ActiveEffect', effect.id));
		}
	}

	for (const scene of game.scenes ?? []) {
		await persistDocument(scene as unknown as DocumentLike, had('Scene', scene.id));
		for (const token of scene.tokens) {
			await persistDocument(token as unknown as DocumentLike, had('Token', token.id));
		}
	}

	for (const journal of game.journal ?? []) {
		await persistDocument(journal as unknown as DocumentLike, had('JournalEntry', journal.id));
	}
	for (const macro of game.macros ?? []) {
		await persistDocument(macro as unknown as DocumentLike, had('Macro', macro.id));
	}
	for (const table of game.tables ?? []) {
		await persistDocument(table as unknown as DocumentLike, had('RollTable', table.id));
	}
	for (const combat of game.combats ?? []) {
		await persistDocument(combat as unknown as DocumentLike, had('Combat', combat.id));
		for (const combatant of combat.combatants) {
			await persistDocument(combatant as unknown as DocumentLike, had('Combatant', combatant.id));
		}
	}
	for (const user of game.users ?? []) {
		await persistDocument(user as unknown as DocumentLike, had('User', user.id));
	}
	for (const message of game.messages ?? []) {
		await persistDocument(message as unknown as DocumentLike, had('ChatMessage', message.id));
	}

	// Persist setting rebrand: create new dev-keyed Setting docs and delete the
	// legacy ones. We can't go through `game.settings.set` because the dev id
	// hasn't registered the foreign keys. Use the Setting document class
	// directly.
	const SettingDoc = (globalThis as unknown as { Setting?: typeof foundry.documents.BaseSetting })
		.Setting;
	for (const legacy of legacySettings) {
		if (!legacy.key || legacy._id == null) continue;

		const settingName = legacy.key.startsWith(`${STABLE_SYSTEM_ID}.`)
			? legacy.key.slice(STABLE_SYSTEM_ID.length + 1)
			: legacy.key.startsWith(`${DEV_SYSTEM_ID}.`)
				? legacy.key.slice(DEV_SYSTEM_ID.length + 1)
				: null;
		if (!settingName) continue;

		const devKey = `${DEV_SYSTEM_ID}.${settingName}`;
		try {
			if (SettingDoc?.create) {
				await (
					SettingDoc.create as unknown as (
						data: { key: string; value: string },
						options?: object,
					) => Promise<unknown>
				)({ key: devKey, value: JSON.stringify(legacy.value) }, { noHook: true }).catch(
					(err: unknown) => {
						console.error(`Nimble | dev-rebrand: failed to create setting ${devKey}:`, err);
					},
				);
			}

			// Delete the legacy doc by id, looked up from the live storage.
			const storage = game.settings?.storage?.get('world') as
				| {
						contents?: RawSetting[];
						get?(id: string): { delete(options?: object): Promise<unknown> } | undefined;
				  }
				| undefined;
			const legacyDoc = storage?.get?.(legacy._id);
			await legacyDoc?.delete({ noHook: true }).catch((err: unknown) => {
				console.error(`Nimble | dev-rebrand: failed to delete legacy setting ${legacy.key}:`, err);
			});
		} catch (err) {
			console.error(`Nimble | dev-rebrand: error persisting setting ${legacy.key}:`, err);
		}
	}
}

// ---------------------------------------------------------------------------
// Detection & confirmation.
// ---------------------------------------------------------------------------

function detectLegacyDataInRaw(): boolean {
	const data = (game as unknown as { data?: RawWorldData }).data;
	if (!data) return false;

	const sources: FlagBearing[][] = [
		(data.actors ?? []) as FlagBearing[],
		(data.items ?? []) as FlagBearing[],
		(data.scenes ?? []) as FlagBearing[],
		(data.journal ?? []) as FlagBearing[],
		(data.macros ?? []) as FlagBearing[],
		(data.tables ?? []) as FlagBearing[],
		(data.combats ?? []) as FlagBearing[],
		(data.users ?? []) as FlagBearing[],
		(data.messages ?? []) as FlagBearing[],
	];

	for (const collection of sources) {
		for (const src of collection) {
			if (hasLegacyFlags(src)) return true;
		}
	}
	// Embedded.
	for (const actor of data.actors ?? []) {
		for (const item of actor.items ?? []) if (hasLegacyFlags(item)) return true;
		for (const effect of actor.effects ?? []) if (hasLegacyFlags(effect)) return true;
	}
	for (const item of data.items ?? []) {
		for (const effect of item.effects ?? []) if (hasLegacyFlags(effect)) return true;
	}
	for (const scene of data.scenes ?? []) {
		for (const token of scene.tokens ?? []) {
			if (hasLegacyFlags(token)) return true;
			if (token.delta && hasLegacyFlags(token.delta)) return true;
		}
	}
	for (const combat of data.combats ?? []) {
		for (const combatant of combat.combatants ?? []) {
			if (hasLegacyFlags(combatant)) return true;
		}
	}

	const storage = game.settings?.storage?.get('world') as { contents?: RawSetting[] } | undefined;
	for (const setting of storage?.contents ?? []) {
		if (typeof setting.key === 'string' && setting.key.startsWith(`${STABLE_SYSTEM_ID}.`)) {
			return true;
		}
	}

	return false;
}

async function confirmRebrand(): Promise<boolean> {
	const dialogApi = (foundry as unknown as { applications?: { api?: { DialogV2?: any } } })
		.applications?.api?.DialogV2;
	if (!dialogApi?.confirm) {
		console.warn(
			'Nimble | dev-rebrand: DialogV2 not yet available at preInitGame; proceeding without confirmation.',
		);
		return true;
	}

	return (
		(await dialogApi.confirm({
			window: { title: localize('NIMBLE.devRebrand.dialog.title') },
			content: `
				<p>${localize('NIMBLE.devRebrand.dialog.intro')}</p>
				<p>${localize('NIMBLE.devRebrand.dialog.body')}</p>
				<p><strong>${localize('NIMBLE.devRebrand.dialog.warning')}</strong></p>
			`,
			yes: { label: localize('NIMBLE.devRebrand.dialog.confirm') },
			no: { label: localize('NIMBLE.devRebrand.dialog.cancel') },
			rejectClose: false,
		})) === true
	);
}

// ---------------------------------------------------------------------------
// Entry points (called from hooks/init.ts).
// ---------------------------------------------------------------------------

interface PendingPersistence {
	registry: LegacyRegistry;
	legacySettings: RawSetting[];
	stats: RebrandStats;
}

let pendingPersistence: PendingPersistence | null = null;

/**
 * Phase 1: in-memory rebrand. Register on the `init` hook BEFORE any other
 * init handler that might trigger document interaction.
 *
 * Rewrites `game.data.*` source arrays so document construction (which happens
 * later, between `init` and `setup`) sees only dev-keyed flags. If legacy data
 * is found, prompts the GM to confirm before mutating. Caches the rebrand
 * intent for phase 2 to persist to the DB on `ready`.
 */
export async function runDevFlagRebrandPreInit(): Promise<void> {
	if (SYSTEM_ID !== DEV_SYSTEM_ID) return;
	if (!game.user?.isGM) return;
	if (!detectLegacyDataInRaw()) return;

	const confirmed = await confirmRebrand();
	if (!confirmed) {
		console.info(
			'Nimble | dev-rebrand: user cancelled at preInitGame. Skipping rebrand for this session.',
		);
		return;
	}

	// Build the legacy registry BEFORE we mutate, so phase 2 knows which
	// documents need a DB write.
	const registry = buildLegacyRegistry();
	const stats = emptyStats();

	rebrandInMemory(stats);
	const legacySettings = rebrandSettingsInMemory(stats);

	console.info(
		`Nimble | dev-rebrand: in-memory rebrand complete (${statsSummary(stats)}). Persisting on ready.`,
	);

	pendingPersistence = { registry, legacySettings, stats };
}

/**
 * Phase 2: persist the rebrand to the database. Call from a `ready` hook
 * handler. No-op if phase 1 didn't run or didn't find anything to do.
 */
export async function runDevFlagRebrandPersist(): Promise<void> {
	if (!pendingPersistence) return;
	const { registry, legacySettings, stats } = pendingPersistence;
	pendingPersistence = null;

	ui.notifications?.info(localize('NIMBLE.devRebrand.notifications.starting'));
	try {
		await persistRebrand(registry, legacySettings);
		console.info(`Nimble | dev-rebrand: persistent rebrand complete (${statsSummary(stats)}).`);
		ui.notifications?.info(localize('NIMBLE.devRebrand.notifications.completed'));
	} catch (err) {
		console.error('Nimble | dev-rebrand: persistent rebrand failed:', err);
		ui.notifications?.error(localize('NIMBLE.devRebrand.notifications.failed'));
	}
}
