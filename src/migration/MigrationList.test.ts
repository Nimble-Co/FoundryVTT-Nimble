import { describe, expect, it } from 'vitest';
import { MigrationList } from './MigrationList.js';
import { MigrationRunnerBase } from './MigrationRunnerBase.js';

describe('MigrationList', () => {
	// `ready.ts` only runs migrations while worldSchemaVersion < LATEST_SCHEMA_VERSION,
	// so a migration added without bumping the constant never runs on a world already
	// stamped at the old version.
	it('stamps worlds at the highest registered migration version', () => {
		expect(MigrationRunnerBase.LATEST_SCHEMA_VERSION).toBe(MigrationList.latestVersion);
	});

	it('gives every migration a distinct version', () => {
		const versions = MigrationList.constructAll().map((migration) => migration.version);

		expect(new Set(versions).size).toBe(versions.length);
	});
});
