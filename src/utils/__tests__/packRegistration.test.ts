import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type PackEntry = { name: string; path: string; type: string };

const PACKS_DIR = path.resolve(process.cwd(), 'packs');

const manifestPacks = (): PackEntry[] =>
	(
		JSON.parse(readFileSync(path.resolve(process.cwd(), 'public/system.json'), 'utf-8')) as {
			packs: PackEntry[];
		}
	).packs;

const packFolders = (): string[] =>
	readdirSync(PACKS_DIR)
		.filter((entry) => statSync(path.join(PACKS_DIR, entry)).isDirectory())
		.sort();

describe('pack registration', () => {
	it('has a system.json entry for every pack folder, by the base name of its path', () => {
		const registered = manifestPacks().map((entry) => path.basename(entry.path, '.db'));
		const missing = packFolders().filter((folder) => !registered.includes(folder));
		expect(missing).toEqual([]);
	});

	it('has a pack folder for every system.json entry', () => {
		const folders = packFolders();
		const orphans = manifestPacks()
			.map((entry) => path.basename(entry.path, '.db'))
			.filter((base) => !folders.includes(base));
		expect(orphans).toEqual([]);
	});

	it('registers the Monster Abilities and Hazards compendiums as Item packs', () => {
		const byName = new Map(manifestPacks().map((entry) => [entry.name, entry]));
		expect(byName.get('nimble-monster-abilities')).toMatchObject({
			label: 'Nimble Monster Abilities',
			path: 'packs/monsterAbilities.db',
			type: 'Item',
		});
		expect(byName.get('nimble-hazards')).toMatchObject({
			label: 'Nimble Hazards',
			path: 'packs/hazards.db',
			type: 'Item',
		});
	});
});
