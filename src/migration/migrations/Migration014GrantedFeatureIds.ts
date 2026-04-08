import { MigrationBase } from '../MigrationBase.js';

/**
 * Backfills `grantedFeatureIds` on existing `levelUpHistory` entries.
 *
 * Before this feature, characters that leveled up did not track which
 * features were granted at each level. This migration matches existing
 * embedded feature items (via their `system.class` and `system.gainedAtLevel`
 * / `system.gainedAtLevels` fields) to the appropriate history entry.
 *
 * When a feature is available at multiple levels, it is assigned to the
 * lowest level that has a matching history entry.
 */
class Migration014GrantedFeatureIds extends MigrationBase {
	static override readonly version = 14;

	override readonly version = Migration014GrantedFeatureIds.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'character') return;

		const history: any[] | undefined = source.system?.levelUpHistory;
		if (!Array.isArray(history) || history.length === 0) return;

		// Ensure every history entry has a grantedFeatureIds array
		for (const entry of history) {
			if (!Array.isArray(entry.grantedFeatureIds)) {
				entry.grantedFeatureIds = [];
			}
		}

		// Only backfill entries that are still empty
		const entriesToPopulate = history.filter((e) => e.grantedFeatureIds.length === 0);
		if (entriesToPopulate.length === 0) return;

		// Build a lookup of unpopulated entries: "classIdentifier:level" → entry
		const historyByClassLevel = new Map<string, any>();
		for (const entry of entriesToPopulate) {
			const key = `${entry.classIdentifier}:${entry.level}`;
			historyByClassLevel.set(key, entry);
		}

		// Track assigned items to prevent double-counting
		const assignedItemIds = new Set<string>();

		// Match each embedded feature item to the lowest matching history entry
		for (const item of source.items ?? []) {
			if (item.type !== 'feature') continue;

			const system = item.system;
			if (!system?.class || system.subclass) continue;

			// Collect all levels this feature is available at, sorted ascending
			const levels: number[] = [];
			if (system.gainedAtLevel) levels.push(system.gainedAtLevel);
			if (Array.isArray(system.gainedAtLevels)) levels.push(...system.gainedAtLevels);
			levels.sort((a, b) => a - b);

			if (levels.length === 0) continue;

			// Assign to the lowest level with a matching unpopulated history entry
			for (const level of levels) {
				const key = `${system.class}:${level}`;
				const historyEntry = historyByClassLevel.get(key);
				if (historyEntry && !assignedItemIds.has(item._id)) {
					historyEntry.grantedFeatureIds.push(item._id);
					assignedItemIds.add(item._id);
					break;
				}
			}
		}
	}
}

export { Migration014GrantedFeatureIds };
