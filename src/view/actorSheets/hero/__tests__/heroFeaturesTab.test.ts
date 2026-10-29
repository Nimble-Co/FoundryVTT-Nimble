import { describe, expect, it } from 'vitest';
import {
	blankHero,
	featureHero,
	heroContext,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroFeaturesTab } from '../heroFeaturesTab.ts';

const FEAT = 'NIMBLE.actorSheet.hero.features';

const layout = (view: ReturnType<typeof heroFeaturesTab>) =>
	view.groups.map((group) => [
		group.label,
		group.rows.map((row) => row.name),
		...(group.subgroups ?? []).map((sub) => [sub.label, sub.rows.map((row) => row.name)]),
	]);

const rowOf = (view: ReturnType<typeof heroFeaturesTab>, id: string) => {
	const row = view.groups
		.flatMap((group) => [...group.rows, ...(group.subgroups ?? []).flatMap((sub) => sub.rows)])
		.find((entry) => entry.id === id);
	if (!row) throw new Error(`no row ${id}`);
	return row;
};

describe('heroFeaturesTab', () => {
	it('nests the class features, the subclass and each selection group under the class, by level then A to Z', () => {
		const view = heroFeaturesTab(featureHero(), heroContext());

		expect(layout(view)).toEqual([
			[
				'NIMBLE.featureTypes.class',
				['Berserker', 'Intensifying Fury', 'Rage', 'Quick Tempered'],
				['Path of the Red Mist', ['Path of the Red Mist', 'Bloodlust']],
				['Savage Arsenal', ['Deathless Rage', 'Mighty Endurance']],
			],
			['NIMBLE.featureTypeHeadings.ancestry', ['Dragonborn', 'Draconic Breath']],
			['NIMBLE.featureTypeHeadings.background', ['Soldier']],
			['NIMBLE.featureTypeHeadings.boon', ['Boon of Luck']],
		]);
	});

	it('says Exotic on the Ancestry heading for an exotic ancestry', () => {
		const [, ancestry] = heroFeaturesTab(featureHero(), heroContext()).groups;

		expect(ancestry.note).toBe(`${FEAT}.exotic`);
		expect(heroFeaturesTab(blankHero(), heroContext()).groups[1].note).toBeUndefined();
	});

	it('shows the type of a boon in its facts', () => {
		const row = rowOf(heroFeaturesTab(featureHero(), heroContext()), 'boonLuck');

		expect(row.facts).toContainEqual([`${FEAT}.facts.boonType`, 'NIMBLE.boonTypes.major']);
	});

	it('shows the level at which you got a feature in its facts', () => {
		const row = rowOf(heroFeaturesTab(featureHero(), heroContext()), 'mightyEndurance');

		expect(row.facts).toContainEqual([`${FEAT}.facts.level`, '2']);
	});

	it('posts a passive feature to chat from its row, with no cost', () => {
		const row = rowOf(heroFeaturesTab(featureHero(), heroContext()), 'quickTempered');

		expect(row.use).toEqual({
			kind: 'act',
			label: `${FEAT}.post {"name":"Quick Tempered"}`,
			intent: { kind: 'activate', itemId: 'quickTempered' },
		});
		expect(row.cost).toEqual({ uses: [] });
	});

	it('gives the heading of a selection group in Title Case when it has no name', () => {
		const hero = featureHero();
		const feature = hero.items.find((item) => item.id === 'deathlessRage')!;
		feature.system = { ...feature.system, group: 'brand-new-group' };

		const [classGroup] = heroFeaturesTab(hero, heroContext()).groups;

		expect(classGroup.subgroups?.map((sub) => sub.label)).toContain('Brand New Group');
	});

	it('lists the features on their own when the hero has no class', () => {
		const hero = featureHero();
		hero.items = hero.items.filter((item) => item.type !== 'class' && item.type !== 'subclass');

		expect(layout(heroFeaturesTab(hero, heroContext())).slice(0, 3)).toEqual([
			[`${FEAT}.subclass`, ['Bloodlust']],
			['NIMBLE.featureTypeHeadings.feature', ['Intensifying Fury', 'Rage', 'Quick Tempered']],
			['Savage Arsenal', ['Deathless Rage', 'Mighty Endurance']],
		]);
	});

	it('creates a feature', () => {
		const view = heroFeaturesTab(blankHero(), heroContext());

		expect(view.createFeature).toEqual({
			label: `${FEAT}.create`,
			intent: { kind: 'createItem', itemType: 'feature' },
		});
	});
});
