import { describe, expect, it } from 'vitest';
import {
	blankHero,
	heroContext,
	manaCaster,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroSpellsTab } from '../heroSpellsTab.ts';

const SPELLS = 'NIMBLE.actorSheet.hero.spells';

const layout = (view: ReturnType<typeof heroSpellsTab>) =>
	view.groups.map((group) => [group.label, group.rows.map((row) => row.name)]);

describe('heroSpellsTab', () => {
	it('groups by tier when the hero has no choice saved, utility spells with the cantrips', () => {
		const view = heroSpellsTab(manaCaster(), heroContext());

		expect(view.by).toBe('tier');
		expect(layout(view)).toEqual([
			['NIMBLE.spells.tierHeadings.tier0', ['Chillcraft', 'Flame Dart', 'Ice Lance']],
			['NIMBLE.spells.tierHeadings.tier1', ['Frost Shield', 'Ignite']],
		]);
	});

	it('groups by school A to Z, cantrips first, each row with its tier', () => {
		const view = heroSpellsTab(manaCaster({ flags: { spellsBy: 'school' } }), heroContext());

		expect(layout(view)).toEqual([
			['Fire', ['Flame Dart', 'Ignite']],
			['Ice', ['Ice Lance', 'Frost Shield', 'Chillcraft']],
		]);
		expect(view.groups[0].rows[0].summary).toMatch(/^NIMBLE.ui.heroicActions.cantrip, /);
	});

	it('gives the switch and the intent of each choice', () => {
		const view = heroSpellsTab(manaCaster(), heroContext());

		expect(view.groupBy).toEqual({
			label: `${SPELLS}.groupBy`,
			options: [
				{ value: 'tier', label: `${SPELLS}.byTier` },
				{ value: 'school', label: `${SPELLS}.bySchool` },
			],
			intents: {
				tier: { kind: 'setSpellsBy', value: 'tier' },
				school: { kind: 'setSpellsBy', value: 'school' },
			},
		});
	});

	it('casts a spell from its row', () => {
		const [cantrips] = heroSpellsTab(manaCaster(), heroContext()).groups;

		expect(cantrips.rows[1].use).toMatchObject({
			kind: 'act',
			label: 'NIMBLE.actorSheet.hero.actions.cast {"name":"Flame Dart"}',
			intent: { kind: 'activate', itemId: 'flameDart' },
		});
	});

	it('creates a spell, and says when there is none', () => {
		const view = heroSpellsTab(blankHero(), heroContext());

		expect(view.groups).toEqual([]);
		expect(view.empty).toBe(`${SPELLS}.none`);
		expect(view.createSpell.intent).toEqual({ kind: 'createItem', itemType: 'spell' });
	});
});
