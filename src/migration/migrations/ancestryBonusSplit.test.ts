import { describe, expect, it } from 'vitest';

import { Migration035AncestryBonusSplit } from './Migration035AncestryBonusSplit.js';

const DWARF_DESCRIPTION =
	'<p>Dwarf, in the old language, means “stone.”</p>' +
	'<hr>' +
	'<p><strong>Stout</strong></p>' +
	'<p>+2 max Hit Dice [M]</p>' +
	'<p>-1 Speed [M]</p>' +
	'<p>You know Dwarvish if your INT is not negative [M]</p>';

const LANGUAGE_RULE = {
	type: 'grantProficiency',
	proficiencyType: 'languages',
	values: ['dwarvish'],
	label: 'Stout',
};

const SPEED_RULE = { type: 'speedBonus', value: '-1', label: 'Stout' };
const HIT_DICE_RULE = { type: 'maxHitDice', value: '2', label: 'Stout' };

const DWARF_SOURCE_ID = 'Compendium.nimble.nimble-ancestries.Item.hyVaEOLNSagYECwm';
const STOUT_BONUS_UUID = 'Compendium.nimble.nimble-ancestry-bonuses.Item.PwCzys1zJwz79alF';

// A text-only trait: no rules to move, only description to cut. Ten of the 24 core
// ancestries are shaped this way.
const BUNBUN_DESCRIPTION =
	'<p>Bunbun flavor.</p><hr><p><strong>Bunny Legs</strong></p><p>You may jump [M]</p>';

function createCharacter(ancestryOverrides: Record<string, unknown> = {}) {
	const ancestry = {
		_id: 'ancestry1',
		name: 'Dwarf',
		type: 'ancestry',
		img: 'icons/dwarf.webp',
		system: {
			description: DWARF_DESCRIPTION,
			rules: [LANGUAGE_RULE, SPEED_RULE, HIT_DICE_RULE],
		},
		...ancestryOverrides,
	};

	return { name: 'Thorin', type: 'character', items: [ancestry] as any[] };
}

function getBonus(source: { items: any[] }) {
	return source.items.find((item) => item.type === 'ancestryBonus');
}

function getAncestry(source: { items: any[] }) {
	return source.items.find((item) => item.type === 'ancestry');
}

describe('Migration035AncestryBonusSplit', () => {
	const migration = new Migration035AncestryBonusSplit();

	it('extracts the trait into an ancestryBonus item named after the trait', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		const bonus = getBonus(source);
		expect(bonus).toBeDefined();
		expect(bonus.name).toBe('Stout');
		expect(bonus.img).toBe('icons/dwarf.webp');
	});

	it('moves the non-language rules onto the bonus', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		expect(getBonus(source).system.rules).toEqual([SPEED_RULE, HIT_DICE_RULE]);
	});

	it('keeps the language rule on the ancestry', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		expect(getAncestry(source).system.rules).toEqual([LANGUAGE_RULE]);
	});

	it('keeps the "You know <Language>" sentence on the ancestry description', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toBe(
			'<p>Dwarf, in the old language, means “stone.”</p>' +
				'<p>You know Dwarvish if your INT is not negative [M]</p>',
		);
	});

	it('leaves the language sentence off the bonus description', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		const { description } = getBonus(source).system;
		expect(description).not.toMatch(/You know/i);
		expect(description).toBe(
			'<p><strong>Stout</strong></p><p>+2 max Hit Dice [M]</p><p>-1 Speed [M]</p>',
		);
	});

	it('matches the language sentence when the language is renamed in an aside', async () => {
		const source = createCharacter({
			name: 'Gnome',
			system: {
				description:
					'<p>Gnome flavor.</p><hr><p><strong>Trickster</strong></p>' +
					'<p>You know Dwarvish if your INT is not negative (but you call it Gnomish, of course) [M]</p>',
				rules: [LANGUAGE_RULE],
			},
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toContain('but you call it Gnomish');
		expect(getBonus(source).system.description).not.toMatch(/You know/i);
	});

	it('leaves a trait paragraph that says "you know" but names no granted language', async () => {
		const source = createCharacter({
			system: {
				description:
					'<p>Flavor.</p><hr><p><strong>Stout</strong></p><p>You know when danger is near [M]</p>',
				rules: [LANGUAGE_RULE],
			},
		});

		await migration.updateActor(source);

		expect(getBonus(source).system.description).toContain('You know when danger is near');
		expect(getAncestry(source).system.description).toBe('<p>Flavor.</p>');
	});

	it('handles an ancestry with no language rule', async () => {
		const source = createCharacter({
			name: 'Human',
			system: {
				description: '<p>Human flavor.</p><hr><p><strong>Skilled</strong></p><p>+1 Skill [M]</p>',
				rules: [SPEED_RULE],
			},
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toBe('<p>Human flavor.</p>');
		expect(getAncestry(source).system.rules).toEqual([]);
		expect(getBonus(source).system.description).toBe(
			'<p><strong>Skilled</strong></p><p>+1 Skill [M]</p>',
		);
	});

	it('does not create a second bonus when the character already has one', async () => {
		const source = createCharacter();
		source.items.push({ _id: 'bonus1', name: 'Stout', type: 'ancestryBonus', system: {} });

		await migration.updateActor(source);

		expect(source.items.filter((item) => item.type === 'ancestryBonus')).toHaveLength(1);
		expect(getBonus(source)._id).toBe('bonus1');
	});

	it('strips leftover trait rules from the ancestry when the bonus already carries them', async () => {
		// An earlier pass created the bonus but left the ancestry untouched, so the speed
		// penalty applied twice.
		const source = createCharacter();
		source.items.push({
			_id: 'bonus1',
			name: 'Stout',
			type: 'ancestryBonus',
			system: { rules: [SPEED_RULE, HIT_DICE_RULE], description: '<p>Stout</p>' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.rules).toEqual([LANGUAGE_RULE]);
		expect(getAncestry(source).system.description).toBe(
			'<p>Dwarf, in the old language, means “stone.”</p>' +
				'<p>You know Dwarvish if your INT is not negative [M]</p>',
		);
		// The bonus keeps the rules it already had — they are not duplicated back onto it.
		expect(getBonus(source).system.rules).toEqual([SPEED_RULE, HIT_DICE_RULE]);
	});

	it('matches a carried rule that was reauthored with a different id', async () => {
		const source = createCharacter({
			system: {
				description: DWARF_DESCRIPTION,
				rules: [LANGUAGE_RULE, { ...SPEED_RULE, id: 'ancestryCopy' }],
			},
		});
		source.items.push({
			_id: 'bonus1',
			name: 'Stout',
			type: 'ancestryBonus',
			system: { rules: [{ ...SPEED_RULE, id: 'bonusCopy' }], description: '<p>Stout</p>' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.rules).toEqual([LANGUAGE_RULE]);
	});

	it('keeps ancestry rules the existing bonus does not carry', async () => {
		// The player swapped to a different bonus; the ancestry's own trait rules are not
		// duplicated anywhere, so deleting them would lose the rule outright.
		const source = createCharacter();
		source.items.push({
			_id: 'bonus1',
			name: 'Lithe',
			type: 'ancestryBonus',
			system: { rules: [{ type: 'initiativeBonus', value: '1' }], description: '<p>Lithe</p>' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.rules).toEqual([LANGUAGE_RULE, SPEED_RULE, HIT_DICE_RULE]);
		expect(getAncestry(source).system.description).toBe(DWARF_DESCRIPTION);
	});

	it('keeps only the uncarried rules on a partially migrated ancestry', async () => {
		const source = createCharacter();
		source.items.push({
			_id: 'bonus1',
			name: 'Stout',
			type: 'ancestryBonus',
			system: { rules: [SPEED_RULE], description: '<p>Stout</p>' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.rules).toEqual([LANGUAGE_RULE, HIT_DICE_RULE]);
		// Rules remain on the ancestry, so its description still describes what it applies.
		expect(getAncestry(source).system.description).toBe(DWARF_DESCRIPTION);
	});

	it('is idempotent once the ancestry has been stripped', async () => {
		const source = createCharacter();

		await migration.updateActor(source);
		const afterFirst = JSON.stringify(source.items);
		await migration.updateActor(source);

		expect(JSON.stringify(source.items)).toBe(afterFirst);
	});

	it('is a no-op for an already trait-free ancestry', async () => {
		const source = createCharacter({
			system: { description: '<p>Flavor only.</p>', rules: [LANGUAGE_RULE] },
		});

		await migration.updateActor(source);

		expect(getBonus(source)).toBeUndefined();
		expect(getAncestry(source).system.description).toBe('<p>Flavor only.</p>');
	});

	it('strips a text-only trait from an ancestry whose bonus already exists', async () => {
		// No non-language rules means nothing to deduplicate, so the repair branch used to
		// bail out before touching the description and the trait text stayed on both items.
		const source = createCharacter({
			name: 'Bunbun',
			system: { description: BUNBUN_DESCRIPTION, rules: [] },
		});
		source.items.push({
			_id: 'bonus1',
			name: 'Bunny Legs',
			type: 'ancestryBonus',
			system: { rules: [], description: '<p><strong>Bunny Legs</strong></p>' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toBe('<p>Bunbun flavor.</p>');
		expect(source.items.filter((item) => item.type === 'ancestryBonus')).toHaveLength(1);
	});

	it('is idempotent on a repaired text-only ancestry', async () => {
		const source = createCharacter({
			name: 'Bunbun',
			system: { description: BUNBUN_DESCRIPTION, rules: [] },
		});
		source.items.push({
			_id: 'bonus1',
			name: 'Bunny Legs',
			type: 'ancestryBonus',
			system: { rules: [], description: '<p><strong>Bunny Legs</strong></p>' },
		});

		await migration.updateActor(source);
		const afterFirst = JSON.stringify(source.items);
		await migration.updateActor(source);

		expect(JSON.stringify(source.items)).toBe(afterFirst);
	});

	it('backfills the ancestry default bonus from its compendium source', async () => {
		const source = createCharacter({ _stats: { compendiumSource: DWARF_SOURCE_ID } });

		await migration.updateActor(source);

		expect(getAncestry(source).system.defaultBonus).toBe(STOUT_BONUS_UUID);
	});

	it('backfills the default bonus even when the ancestry is already trait-free', async () => {
		const source = createCharacter({
			_stats: { compendiumSource: DWARF_SOURCE_ID },
			system: { description: '<p>Flavor only.</p>', rules: [LANGUAGE_RULE] },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.defaultBonus).toBe(STOUT_BONUS_UUID);
		expect(getBonus(source)).toBeUndefined();
	});

	it('leaves an existing default bonus pointer alone', async () => {
		const source = createCharacter({
			_stats: { compendiumSource: DWARF_SOURCE_ID },
			system: { description: DWARF_DESCRIPTION, rules: [LANGUAGE_RULE], defaultBonus: 'Item.abc' },
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.defaultBonus).toBe('Item.abc');
	});

	it('stamps the pack origin on a bonus that matches the ancestry default', async () => {
		const source = createCharacter({ _stats: { compendiumSource: DWARF_SOURCE_ID } });

		await migration.updateActor(source);

		expect(getBonus(source)._stats?.compendiumSource).toBe(STOUT_BONUS_UUID);
	});

	it('leaves the pack origin off a trait that was renamed away from the default', async () => {
		const source = createCharacter({
			_stats: { compendiumSource: DWARF_SOURCE_ID },
			system: {
				description: '<p>Flavor.</p><hr><p><strong>Homebrewed</strong></p><p>+1 Speed [M]</p>',
				rules: [SPEED_RULE],
			},
		});

		await migration.updateActor(source);

		expect(getBonus(source).name).toBe('Homebrewed');
		expect(getBonus(source)._stats).toBeUndefined();
	});

	it('splits on an <hr> that carries attributes', async () => {
		const source = createCharacter({
			system: {
				description: '<p>Flavor.</p><hr class="divider"><p><strong>Stout</strong></p>',
				rules: [SPEED_RULE],
			},
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toBe('<p>Flavor.</p>');
		expect(getBonus(source).name).toBe('Stout');
	});

	it('does not throw on a language name containing regex metacharacters', async () => {
		const source = createCharacter({
			system: {
				description:
					'<p>Flavor.</p><hr><p><strong>Fey Touched</strong></p>' +
					'<p>You know Sylvan (Fey if your INT is not negative [M]</p>',
				rules: [{ ...LANGUAGE_RULE, values: ['Sylvan (Fey'] }],
			},
		});

		await migration.updateActor(source);

		expect(getAncestry(source).system.description).toContain('You know Sylvan (Fey');
		expect(getBonus(source).system.description).not.toMatch(/You know/i);
	});

	it('ignores actors that are not characters', async () => {
		const source = { name: 'Goblin', type: 'npc', items: [] as any[] };

		await migration.updateActor(source);

		expect(source.items).toHaveLength(0);
	});
});
