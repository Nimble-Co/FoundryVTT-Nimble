import type { MigrationBase } from './MigrationBase.js';

interface CollectionDiff<T = any> {
	inserted: T[];
	deleted: string[];
	updated: T[];
}

class MigrationRunnerBase {
	migrations: MigrationBase[];

	static LATEST_SCHEMA_VERSION = 97;

	static RECOMMENDED_SAFE_VERSION = 0;

	static MINIMUM_SAFE_VERSION = 0;

	constructor(migrations?: MigrationBase[]) {
		if (!migrations) this.migrations = [];
		else this.migrations = migrations.sort((a, b) => a.version - b.version);
	}

	needsMigration(currentVersion: number): boolean {
		return currentVersion < MigrationRunnerBase.LATEST_SCHEMA_VERSION;
	}

	diffCollection(original: any[], updated: any[]): CollectionDiff {
		const diffs: CollectionDiff = {
			inserted: [],
			deleted: [],
			updated: [],
		};

		const originalSources: Map<string, any> = new Map();
		original.forEach((source) => {
			originalSources.set(source._id, source);
		});

		updated.forEach((source) => {
			const originalSource = originalSources.get(source._id);
			if (originalSource) {
				if (JSON.stringify(originalSource) !== JSON.stringify(source)) {
					diffs.updated.push(source);
				}

				originalSources.delete(source._id);
			} else {
				diffs.inserted.push(source);
			}
		});

		originalSources.forEach((source) => {
			diffs.deleted.push(source._id);
		});

		return diffs;
	}
}

export { MigrationRunnerBase };
