import { describe, expect, it } from 'vitest';

import { Migration044HauntedPastFearAdvantage } from './Migration044HauntedPastFearAdvantage.js';

const HAUNTED_PAST_SOURCE_ID = 'Compendium.nimble.nimble-backgrounds.Item.TfYvarCWkHj2qVfa';
const RULE_ID = 'N43aM4mMNGpq5WN6';
const SUPERSEDED_RULE_ID = 'NWCRKRwheYMcCuFN';

/** The blanket WIL rule an earlier draft of this migration installed. */
const SUPERSEDED_RULE = {
	type: 'savingThrowRollMode',
	id: SUPERSEDED_RULE_ID,
	label: 'Haunted Past',
	value: 1,
	target: 'will',
	mode: 'adjust',
	priority: 2,
};

function createCharacter({
	backgroundName = 'Haunted Past',
	compendiumSource = HAUNTED_PAST_SOURCE_ID as string | undefined,
	rules = [] as any[],
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
			{ type: 'class', system: { savingThrows: { advantage: 'strength', disadvantage: 'will' } } },
		],
	} as any;
}

function backgroundRules(source: any): any[] {
	return source.items.find((item: any) => item.type === 'background').system.rules;
}

describe('Migration044HauntedPastFearAdvantage', () => {
	const migration = new Migration044HauntedPastFearAdvantage();

	it('adds the situational WIL rule to the embedded background', async () => {
		const source = createCharacter();

		await migration.updateActor(source);

		expect(backgroundRules(source)).toContainEqual(
			expect.objectContaining({
				id: RULE_ID,
				type: 'situationalRollMode',
				checkType: 'savingThrow',
				saves: ['will'],
				value: 1,
				disabled: false,
				label: 'Against fear',
			}),
		);
	});

	// The roller opts in per save, so there is no persisted counterpart to write.
	// Touching the stored roll mode is what made the superseded rule grant advantage
	// on every WIL save rather than only against fear.
	it('leaves the persisted WIL roll mode untouched', async () => {
		const source = createCharacter({ willRollMode: -1 });

		await migration.updateActor(source);

		expect(source.system.savingThrows.will.defaultRollMode).toBe(-1);
	});

	it('drops the superseded blanket rule it installed in an earlier build', async () => {
		const source = createCharacter({ rules: [{ ...SUPERSEDED_RULE }] });

		await migration.updateActor(source);

		expect(backgroundRules(source).map((rule: any) => rule.id)).toEqual([RULE_ID]);
	});

	// Matching the blanket rule by its own pack id is what makes this safe: a GM's
	// hand-authored WIL rule carries a random id and is left in place.
	it('keeps a hand-authored savingThrowRollMode rule while adding the situational one', async () => {
		const handAuthored = {
			type: 'savingThrowRollMode',
			id: 'zZyYxXwWvVuUtTsS',
			target: 'will',
			mode: 'adjust',
			value: 1,
		};
		const source = createCharacter({ rules: [handAuthored] });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toContainEqual(handAuthored);
		expect(backgroundRules(source)).toHaveLength(2);
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
	});

	it('leaves a background that already carries an equivalent hand-authored rule', async () => {
		// The GM built the rule themselves in the Rules Builder, so it has a random
		// id; matching on id alone would offer the player two competing toggles.
		const handAuthored = {
			type: 'situationalRollMode',
			id: 'zZyYxXwWvVuUtTsS',
			checkType: 'savingThrow',
			saves: ['will'],
			value: 1,
		};
		const source = createCharacter({ rules: [handAuthored] });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toEqual([handAuthored]);
	});

	// Only WIL matters here: a homebrew rule on some other save says nothing about
	// whether the fear option has been authored.
	it('adds the rule beside a situational rule that names a different save', async () => {
		const otherSave = {
			type: 'situationalRollMode',
			id: 'zZyYxXwWvVuUtTsS',
			checkType: 'savingThrow',
			saves: ['strength'],
			value: 1,
		};
		const source = createCharacter({ rules: [otherSave] });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(2);
	});

	it('leaves a homebrew background that merely shares the name alone', async () => {
		const source = createCharacter({
			compendiumSource: 'Compendium.world.homebrew-backgrounds.Item.abcdefghijklmnop',
		});

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(0);
	});

	it('appends to rules the background already carries', async () => {
		const existing = { type: 'note', id: 'existing-note' };
		const source = createCharacter({ rules: [existing] });

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(2);
		expect(backgroundRules(source)[0]).toBe(existing);
	});

	it('does not duplicate the rule on a second run', async () => {
		const source = createCharacter();

		await migration.updateActor(source);
		await migration.updateActor(source);

		expect(backgroundRules(source).filter((rule: any) => rule.id === RULE_ID)).toHaveLength(1);
	});

	it('gives each migrated actor its own predicate object', async () => {
		const first = createCharacter();
		const second = createCharacter();

		await migration.updateActor(first);
		await migration.updateActor(second);

		expect(backgroundRules(first)[0].predicate).not.toBe(backgroundRules(second)[0].predicate);
	});

	it('gives each migrated actor its own saves array', async () => {
		const first = createCharacter();
		const second = createCharacter();

		await migration.updateActor(first);
		await migration.updateActor(second);

		expect(backgroundRules(first)[0].saves).not.toBe(backgroundRules(second)[0].saves);
	});

	it('adds the rule to a character with no class', async () => {
		const source = createCharacter();
		source.items = source.items.filter((item: any) => item.type !== 'class');

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(1);
	});

	it('ignores characters without the Haunted Past background', async () => {
		const source = createCharacter({
			backgroundName: 'Fearless',
			compendiumSource: 'Compendium.nimble.nimble-backgrounds.Item.880Dzk9FfksUwlCB',
		});

		await migration.updateActor(source);

		expect(backgroundRules(source)).toHaveLength(0);
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

		it('drops the superseded blanket rule from a world-level copy', async () => {
			const item = worldBackground({ system: { rules: [{ ...SUPERSEDED_RULE }] } });

			await migration.updateItem(item);

			expect(item.system.rules.map((rule: any) => rule.id)).toEqual([RULE_ID]);
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
