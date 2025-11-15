import type { MigrationBase } from './MigrationBase';
import { MigrationRunner } from './MigrationRunner';
import * as Migrations from './migrations/index';

const list: { new (): MigrationBase; version: number }[] = Object.values(Migrations);

const MigrationList = {
	get latestVersion(): number {
		return Math.max(...list.map((m) => m.version));
	},

	constructAll(): MigrationBase[] {
		return list.map((M) => new M());
	},

	constructFromVersion(version?: number) {
		const minVersion = Number(version) || MigrationRunner.RECOMMENDED_SAFE_VERSION;

		return list.reduce((acc, M) => {
			if (M.version > minVersion) acc.push(new M());
			return acc;
		}, [] as MigrationBase[]);
	},

	constructRange(min: number, max = Number.POSITIVE_INFINITY) {
		return list.reduce((acc, M) => {
			if (M.version >= min && M.version <= max) acc.push(new M());
			return acc;
		}, [] as MigrationBase[]);
	},
};

export { MigrationList };
