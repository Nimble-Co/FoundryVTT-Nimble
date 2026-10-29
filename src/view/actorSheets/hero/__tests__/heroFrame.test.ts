import { describe, expect, it } from 'vitest';
import {
	blankHero,
	effectsContext,
	effectsHero,
	heroContext,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroFrame } from '../heroFrame.ts';

const TABS = 'NIMBLE.actorSheet.hero.tabs';

describe('heroFrame', () => {
	it('gives the eight fixed tabs in order, each with its icon and label', () => {
		const { tabs, tabsLabel } = heroFrame(blankHero(), heroContext());

		expect(tabsLabel).toBe(`${TABS}.label`);
		expect(tabs.map(({ id, icon, label }) => [id, icon, label])).toEqual([
			['core', 'fa-solid fa-home', `${TABS}.core`],
			['actions', 'fa-solid fa-bolt', `${TABS}.actions`],
			['features', 'fa-solid fa-table-list', `${TABS}.features`],
			['inventory', 'fa-solid fa-box-open', `${TABS}.inventory`],
			['spells', 'fa-solid fa-wand-sparkles', `${TABS}.spells`],
			['effects', 'fa-solid fa-heart-pulse', `${TABS}.effects`],
			['bio', 'fa-solid fa-file-lines', `${TABS}.bio`],
			['settings', 'fa-solid fa-cog', `${TABS}.settings`],
		]);
	});

	it('counts what is on the hero on the Effects tab, and shows no count for none', () => {
		const effects = (view: ReturnType<typeof heroFrame>) =>
			view.tabs.find((tab) => tab.id === 'effects');

		expect(effects(heroFrame(effectsHero(), effectsContext()))).toMatchObject({
			badge: 3,
			badgeTitle: `${TABS}.effectsBadge {"count":"3"}`,
		});
		expect(effects(heroFrame(blankHero(), heroContext()))?.badge).toBe(0);
	});

	it('gives the words of the edit band', () => {
		expect(heroFrame(blankHero(), heroContext()).editBand).toEqual({
			title: 'NIMBLE.actorSheet.hero.frame.editing',
			hint: 'NIMBLE.actorSheet.hero.frame.editingHint',
			done: 'NIMBLE.actorSheet.hero.frame.done',
		});
	});
});
