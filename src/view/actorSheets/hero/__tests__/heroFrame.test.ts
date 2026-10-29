import { describe, expect, it } from 'vitest';
import { heroContext } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroFrame } from '../heroFrame.ts';

describe('heroFrame', () => {
	it('gives the tabs that are built, each with its icon and label', () => {
		expect(heroFrame(heroContext())).toMatchObject({
			tabsLabel: 'NIMBLE.actorSheet.hero.tabs.label',
			tabs: [{ id: 'core', icon: 'fa-solid fa-home', label: 'NIMBLE.actorSheet.hero.tabs.core' }],
		});
	});

	it('gives the words of the edit band', () => {
		expect(heroFrame(heroContext()).editBand).toEqual({
			title: 'NIMBLE.actorSheet.hero.frame.editing',
			hint: 'NIMBLE.actorSheet.hero.frame.editingHint',
			done: 'NIMBLE.actorSheet.hero.frame.done',
		});
	});
});
