import { describe, expect, it } from 'vitest';

import { Migration044HauntedPastFearAdvantage } from './Migration044HauntedPastFearAdvantage.js';

const HAUNTED_PAST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.TfYvarCWkHj2qVfa';
const RULE_ID = 'NWCRKRwheYMcCuFN';

/** Celestial's Highborn bonus: neutralizes whichever save the class disadvantages. */
const HIGHBORN_RULE = {
	type: 'savingThrowRollMode',
	label: 'Highborn',
	value: 0,
	target: 'disadvantaged',
	mode: 'set',
};

function createCharacter({
	backgroundName = 'Haunted Past',
	compendiumSource = HAUNTED_PAST_SOURCE_ID as string | undefined,
	rules = [] as any[],
	classSaves = { advantage: 'strength', disadvantage: 'dexterity' } as {
		advantage: string | null;
		disadvantage: string | null;
	} | null,
	ancestryBonusRules = null as any[] | null,
	willRollMode = 0,
} = {}) {
	return {
		type: 'character',
		system: { savingThrows: { will: { defaultRollMode: willRollMode } } },
		items: [
			{
				type: 'background',
				name: backgroundName,
				_stats: { compendiumSource },
				system: { rules },
			},
			...(classSaves ? [{ type: 'class', system: { savingThrows: classSaves } }] : []),
			...(ancestryBonusRules
				? [{ type: 'ancestryBonus', name: 'Highborn', system: { rules: ancestryBonusRules } }]
				: []),
		],
	} as any;
}

function backgroundRules(source: any): any[] {
	return source.items.find((item: any) => item.type === 'background').system.rules;
}

describe('Migration044HauntedPastFearAdvantage', () => {
	const migration = new Migration044HauntedPastFearAdvantage();

	it('adds the rule and advantages WIL when the class leaves it neutral', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		expect(backgroundRules(source)).toContainEqual(
			expect.objectContaining({ id: RULE_ID, target: 'will', mode: 'adjust', value: 1 }),
		);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('neutralizes WIL when the class disadvantages it', async () => {
		const source = createCharacter({
			classSaves: { advantage: 'strength', disadvantage: 'will' },
			willRollMode: -1,
		});

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(0);
	});

	it('stacks on top of a class advantage on WIL', async () => {
		const source = createCharacter({
			classSaves: { advantage: 'will', disadvantage: 'dexterity' },
			willRollMode: 1,
		});

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(2);
	});

	// The naive "expected value comes from the class alone" guard skipped these
	// characters: Highborn already moved WIL from -1 to 0, so the stored 0 never
	// matched the class-derived -1 and the migration silently did nothing.
	it('recognizes a WIL already neutralized by an ancestry bonus and advantages it', async () => {
		const source = createCharacter({
			classSaves: { advantage: 'strength', disadvantage: 'will' },
			ancestryBonusRules: [HIGHBORN_RULE],
			willRollMode: 0,
		});

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	// Flameborn is the only shipped `requiresChoice` rule: it lands on the save the
	// player picked, not on its own `target`. The replay has to honour both halves
	// or the stored value never matches and the migration silently skips.
	it('replays a configured requiresChoice rule onto its chosen save', async () => {
		const source = createCharacter({
			ancestryBonusRules: [
				{
					type: 'savingThrowRollMode',
					label: 'Flameborn',
					value: 1,
					target: 'neutral',
					mode: 'set',
					requiresChoice: true,
					selectedSave: 'will',
				},
			],
			willRollMode: 1,
		});

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(2);
	});

	it('skips a requiresChoice rule whose save was never chosen', async () => {
		const source = createCharacter({
			ancestryBonusRules: [
				{
					type: 'savingThrowRollMode',
					label: 'Flameborn',
					value: 1,
					target: 'neutral',
					mode: 'set',
					requiresChoice: true,
					selectedSave: null,
				},
			],
			willRollMode: 0,
		});

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('normalizes a background whose rules array is missing', async () => {
		const source = createCharacter();
		source.items.find((item: any) => item.type === 'background').system.rules = undefined;

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
	});

	it('matches a background stored under the dev-rebrand compendium prefix', async () => {
		const source = createCharacter({
			backgroundName: 'Renamed By The Player',
			compendiumSource: 'Compendium.nimble-dev.nimble-backgrounds.Item.TfYvarCWkHj2qVfa',
		});

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('matches on name only when the background carries no compendium source', async () => {
		const source = createCharacter({ compendiumSource: undefined });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
	});

	// A GM who imports the compendium into the world Items sidebar gets picked
	// ahead of the pack copy at creation, so the stamped source is `Item.<id>`.
	// This is the shadowing case Migration022 exists for.
	it('matches a background embedded from a world-item copy', async () => {
		const source = createCharacter({ compendiumSource: 'Item.aBcDeFgHiJkLmNoP' });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('leaves a background that already carries an equivalent hand-authored rule', async () => {
		// The GM built the rule themselves in the Rules Builder, so it has a random
		// id; matching on id alone would append a second +1.
		const handAuthored = {
			type: 'savingThrowRollMode',
			id: 'zZyYxXwWvVuUtTsS',
			target: 'will',
			mode: 'adjust',
			value: 1,
		};
		const source = createCharacter({ rules: [handAuthored], willRollMode: 1 });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('leaves a homebrew background that merely shares the name alone', async () => {
		const source = createCharacter({
			compendiumSource: 'Compendium.world.homebrew-backgrounds.Item.abcdefghijklmnop',
		});

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(0);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(0);
	});

	it('appends to rules the background already carries', async () => {
		const existing = { type: 'note', id: 'existing-note' };
		const source = createCharacter({ rules: [existing] });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(2);
		expect(backgroundRules(source)[0]).toBe(existing);
	});

	it('is idempotent — a second run neither duplicates the rule nor re-adjusts WIL', async () => {
		const source = createCharacter();

		await migration.updateActor(source);
		await migration.updateActor(source);

		expect(backgroundRules(source).filter((rule: any) => rule.id === RULE_ID)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(1);
	});

	it('gives each migrated actor its own predicate object', async () => {
		const first = createCharacter();
		const second = createCharacter();

		await migration.updateActor(first);
		await migration.updateActor(second);

		expect(backgroundRules(first)[0].predicate).not.toBe(backgroundRules(second)[0].predicate);
	});

	it('leaves a hand-tuned WIL roll mode alone but still adds the rule', async () => {
		// The player raised WIL in the saving throw config dialog; re-tuning it
		// silently would overwrite a deliberate choice.
		const source = createCharacter({ willRollMode: 3 });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(3);
	});

	it('adds the rule but leaves WIL alone when the character has no class', async () => {
		const source = createCharacter({ classSaves: null });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(0);
	});

	it('ignores characters without the Haunted Past background', async () => {
		const source = createCharacter({
			backgroundName: 'Fearless',
			compendiumSource: 'Compendium.nimble.nimble-backgrounds.Item.880Dzk9FfksUwlCB',
		});

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(0);
		expect(source.system.savingThrows.will.defaultRollMode).toBe(0);
	});

	it('ignores non-character actors', async () => {
		const source = createCharacter();
		source.type = 'npc';

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(0);
	});

	describe('updateItem', () => {
		function worldBackground(overrides: Record<string, any> = {}) {
			return {
				type: 'background',
				name: 'Haunted Past',
				_stats: { compendiumSource: HAUNTED_PAST_SOURCE_ID },
				system: { rules: [] as any[] },
				...overrides,
			} as any;
		}

		// Without this, a character created after the migration from a stale world
		// copy would reproduce the original bug indefinitely.
		it('adds the rule to a world-level background item', async () => {
			const item = worldBackground();

			await migration.updateItem(item);

			expect(item.system.rules).toContainEqual(expect.objectContaining({ id: RULE_ID }));
		});

		it('leaves embedded items to updateActor', async () => {
			const item = worldBackground();

			await migration.updateItem(item, { type: 'character' });

			expect(item.system.rules).toHaveLength(0);
		});

		it('ignores items that are not Haunted Past', async () => {
			const item = worldBackground({
				name: 'Fearless',
				_stats: { compendiumSource: 'Compendium.nimble.nimble-backgrounds.Item.880Dzk9FfksUwlCB' },
			});

			await migration.updateItem(item);

			expect(item.system.rules).toHaveLength(0);
		});

		it('ignores a non-background item that shares the name', async () => {
			const item = worldBackground({ type: 'feature', _stats: {} });

			await migration.updateItem(item);

			expect(item.system.rules).toHaveLength(0);
		});

		it('tolerates an item with no system data', async () => {
			const item = worldBackground({ system: undefined });

			await expect(migration.updateItem(item)).resolves.toBeUndefined();
		});

		it('is idempotent across repeated runs', async () => {
			const item = worldBackground();

			await migration.updateItem(item);
			await migration.updateItem(item);

			expect(item.system.rules).toHaveLength(1);
		});
	});
});
