import { SYSTEM_ID } from '#system';

/**
 * The compendium namespace migrations snapshot their source ids under.
 *
 * Migrations hardcode `Compendium.nimble.*` ids deliberately (see AGENTS.md's
 * audited exceptions): they describe data as it was written at a point in time,
 * not as the running install resolves it.
 */
export const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** Every namespace a stored id could carry: the stable id, or the dev rebrand. */
const STORED_PREFIXES = [SNAPSHOT_PREFIX, 'Compendium.nimble-dev.'];

/**
 * Folds a stored source id onto the snapshot namespace. `dev-rebrand.mjs`
 * rewrites `packs/**` but not `src/**`, so on the dev build an actor's stored id
 * reads `Compendium.nimble-dev.…` and would never match a literal written in a
 * migration. Document ids are identical across both installs — only the system
 * id segment differs — so the fold is exact. Both forms are folded rather than
 * just the running install's, since actors get exported and imported across the two.
 */
export function toSnapshotId(packSource: string | undefined): string | undefined {
	if (!packSource) return packSource;
	const prefix = STORED_PREFIXES.find((candidate) => packSource.startsWith(candidate));
	return prefix ? `${SNAPSHOT_PREFIX}${packSource.slice(prefix.length)}` : packSource;
}

/** The namespace the running install stores and resolves uuids under. */
const INSTALLED_PREFIX = `Compendium.${SYSTEM_ID}.`;

/**
 * The inverse of `toSnapshotId`: rebrands a snapshot id onto the running install, so that a
 * uuid a migration writes resolves through `fromUuid` on both the stable and the dev build.
 * Ids that carry no snapshot prefix are returned untouched.
 */
export function toInstalledId(snapshotId: string): string {
	return snapshotId.startsWith(SNAPSHOT_PREFIX)
		? `${INSTALLED_PREFIX}${snapshotId.slice(SNAPSHOT_PREFIX.length)}`
		: snapshotId;
}

/** Where every class feature lives. */
const FEATURE_PREFIX = `${SNAPSHOT_PREFIX}nimble-class-features.Item.`;

/** The class feature pack under the name it carried before the rename, still stored on old copies. */
const LEGACY_FEATURE_PREFIX = `${SNAPSHOT_PREFIX}class-features.Item.`;

/** The snapshot id of a stored source id, with an old class feature pack id moved to the current pack. */
export function toPackSourceId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	return snapshotId?.startsWith(LEGACY_FEATURE_PREFIX)
		? `${FEATURE_PREFIX}${snapshotId.slice(LEGACY_FEATURE_PREFIX.length)}`
		: snapshotId;
}

/** Whether a source id names a compendium entry. A copy without one is matched by its name. */
export function isCompendiumId(sourceId: string | undefined): boolean {
	return sourceId?.startsWith('Compendium.') === true;
}
