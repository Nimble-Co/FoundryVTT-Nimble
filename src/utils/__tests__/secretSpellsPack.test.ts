import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

type SpellSource = {
	name: string;
	system: {
		properties: {
			selected: string[];
		};
	};
};

const SECRET_SPELL_NAMES = [
	'Cryotomb',
	'Greater Windform',
	'Hearth & Home',
	'Lesser Windform',
	'Memory Veil',
	'Radiant Bond',
	'Revive',
	'Sparkfetch',
	'Speak With Dead',
	'Teleport',
].sort();

function readSpellSource(relativeFilePath: string): SpellSource {
	return JSON.parse(
		readFileSync(path.resolve(process.cwd(), relativeFilePath), 'utf-8'),
	) as SpellSource;
}

describe('secret spell pack organization', () => {
	it('stores the expected secret spells only in the dedicated secret spell pack', () => {
		const secretSpellFiles = globSync('packs/secretSpells/**/*.json').sort();
		const mainSpellFiles = globSync('packs/spells/**/*.json').sort();
		const legacySecretSpellFiles = globSync('packs/spells/core/secret/**/*.json');

		const secretSpellNames = secretSpellFiles.map((file) => readSpellSource(file).name).sort();
		const mainSpellNames = new Set(mainSpellFiles.map((file) => readSpellSource(file).name));

		expect(secretSpellNames).toEqual(SECRET_SPELL_NAMES);
		expect(legacySecretSpellFiles).toHaveLength(0);

		for (const spellName of SECRET_SPELL_NAMES) {
			expect(mainSpellNames.has(spellName)).toBe(false);
		}
	});

	it('marks every secret spell with the secretSpell property and keeps that property out of the main spell pack', () => {
		const secretSpellFiles = globSync('packs/secretSpells/**/*.json').sort();
		const mainSpellFiles = globSync('packs/spells/**/*.json').sort();

		for (const file of secretSpellFiles) {
			expect(readSpellSource(file).system.properties.selected).toContain('secretSpell');
		}

		for (const file of mainSpellFiles) {
			expect(readSpellSource(file).system.properties.selected).not.toContain('secretSpell');
		}
	});
});
