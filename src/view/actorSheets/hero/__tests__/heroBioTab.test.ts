import { describe, expect, it } from 'vitest';
import { blankHero, heroContext } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroBioTab } from '../heroBioTab.ts';

const BIO = 'NIMBLE.actorSheet.hero.bio';

describe('heroBioTab', () => {
	it('gives age, height, weight and gender as today', () => {
		const hero = blankHero({ system: { details: { age: '112', height: '4 ft 7 in' } } });

		expect(heroBioTab(hero, heroContext()).fields).toEqual([
			{ detail: 'age', label: `${BIO}.age`, value: '112' },
			{ detail: 'height', label: `${BIO}.height`, value: '4 ft 7 in' },
			{ detail: 'weight', label: `${BIO}.weight`, value: '' },
			{ detail: 'gender', label: `${BIO}.gender`, value: '' },
		]);
	});

	it('gives the notes for the editor: the stored text and the text that Foundry enriched', () => {
		const hero = blankHero({ system: { details: { notes: '<p>[[/r 1d6]]</p>' } } });
		const view = heroBioTab(hero, heroContext({ enrichedNotes: '<p><a>1d6</a></p>' }));

		expect(view.notes).toEqual({
			label: `${BIO}.notes`,
			field: 'system.details.notes',
			value: '<p>[[/r 1d6]]</p>',
			enriched: '<p><a>1d6</a></p>',
			empty: null,
		});
	});

	it('has the words for a detail with no value', () => {
		expect(heroBioTab(blankHero(), heroContext()).notSet).toBe(`${BIO}.notSet`);
	});

	it('says so when there are no notes', () => {
		expect(heroBioTab(blankHero(), heroContext()).notes.empty).toBe(`${BIO}.noNotes`);
	});
});
