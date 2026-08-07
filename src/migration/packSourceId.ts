/** The compendium namespace pack source ids are snapshotted under in `src/migration/**`. */
const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** Every namespace a stored id could have been written under — the stable id or the dev rebrand. */
const STORED_PREFIXES = [SNAPSHOT_PREFIX, 'Compendium.nimble-dev.'];

/**
 * Folds a stored source id onto the snapshot namespace the migration specs are written in.
 * `dev-rebrand.mjs` rewrites `packs/**` but not `src/**`, so on the dev build a document's
 * stored id reads `Compendium.nimble-dev.…` and would never match a literal written in a
 * migration. The document ids are identical across the two installs — only the system id
 * segment differs — so the fold is exact. Both forms are folded rather than just the running
 * install's, since actors get exported and imported across the two.
 */
function toSnapshotId(packSource: string | undefined): string | undefined {
	if (!packSource) return packSource;
	const prefix = STORED_PREFIXES.find((candidate) => packSource.startsWith(candidate));
	return prefix ? `${SNAPSHOT_PREFIX}${packSource.slice(prefix.length)}` : packSource;
}

export { SNAPSHOT_PREFIX, toSnapshotId };
