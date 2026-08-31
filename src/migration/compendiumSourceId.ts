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
