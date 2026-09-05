import { describe, expect, it } from 'vitest';
import { MigrationList } from './MigrationList.js';
import { MigrationRunnerBase } from './MigrationRunnerBase.js';

// The version gate reads the hand-maintained constant, not the computed list
// version. If a migration is renumbered without updating the constant, the
// migration silently never runs. This test turns that silence into a failure.
describe('migration schema version', () => {
	it('keeps LATEST_SCHEMA_VERSION equal to the highest registered migration version', () => {
		expect(MigrationRunnerBase.LATEST_SCHEMA_VERSION).toBe(MigrationList.latestVersion);
	});

	it('registers no duplicate migration versions', () => {
		const versions = MigrationList.constructAll().map(
			(migration) => (migration.constructor as { version?: number }).version,
		);
		expect(new Set(versions).size).toBe(versions.length);
	});
});
