import { describe, expect, it } from 'vitest';
import { blankHero, heroContext } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroSettingsTab } from '../heroSettingsTab.ts';

const SET = 'NIMBLE.actorSheet.hero.settings';

const settingOf = (view: ReturnType<typeof heroSettingsTab>, id: string) => {
	const setting = [...view.groups, view.needsAPlace]
		.flatMap((group) => group.settings)
		.find((entry) => entry.id === id);
	if (!setting) throw new Error(`no setting ${id}`);
	return setting;
};

describe('heroSettingsTab', () => {
	it('keeps the groups of today, with the bonuses and the passive skill scores', () => {
		const view = heroSettingsTab(blankHero(), heroContext());

		expect(
			view.groups.map((group) => [group.label, group.settings.map((entry) => entry.id)]),
		).toEqual([
			[`${SET}.groups.image`, ['imageX', 'imageY', 'imageScale']],
			[`${SET}.groups.items`, ['runMacros']],
			[`${SET}.groups.inventory`, ['trackSlots', 'currencyBulk', 'bonusSlots']],
			[`${SET}.groups.bonuses`, ['woundsBonus', 'initiativeBonus']],
			[`${SET}.groups.skills`, ['passiveSkills']],
			[`${SET}.groups.spells`, ['spellTier', 'resetSpellTier']],
			['NIMBLE.jsonExport.sectionHeader', ['exportPdf', 'exportJson']],
		]);
	});

	it('reads each flag, with today’s defaults when the flag is not set', () => {
		const view = heroSettingsTab(blankHero(), heroContext());

		expect(settingOf(view, 'imageScale')).toMatchObject({ kind: 'number', value: 100 });
		expect(settingOf(view, 'runMacros')).toMatchObject({
			kind: 'check',
			on: true,
			target: { kind: 'flag', flag: 'automaticallyExecuteAvailableMacros' },
		});
		expect(settingOf(view, 'trackSlots')).toMatchObject({ on: true });
		expect(settingOf(view, 'passiveSkills')).toMatchObject({
			on: false,
			target: { kind: 'flag', flag: 'showPassiveSkillScores' },
		});
	});

	it('hides the currency bulk and the bonus slots when the hero does not track slots', () => {
		const view = heroSettingsTab(
			blankHero({ flags: { trackInventorySlots: false } }),
			heroContext(),
		);

		expect(view.groups[2].settings.map((entry) => entry.id)).toEqual(['trackSlots']);
	});

	it('edits the max wounds bonus and the initiative bonus formula', () => {
		const hero = blankHero({
			system: { attributes: { wounds: { bonus: 1 }, initiative: { bonuses: '1d4' } } },
		});
		const view = heroSettingsTab(hero, heroContext());

		expect(settingOf(view, 'woundsBonus')).toEqual({
			kind: 'number',
			id: 'woundsBonus',
			label: `${SET}.woundsBonus`,
			hint: `${SET}.maxWounds {"max":"6"}`,
			value: 1,
			target: { kind: 'field', field: 'woundsBonus' },
		});
		expect(settingOf(view, 'initiativeBonus')).toMatchObject({
			kind: 'text',
			value: '1d4',
			target: { kind: 'field', field: 'initiativeBonuses' },
		});
	});

	it('shows the spell tier that the hero has, and resets it to the tier from the spells', () => {
		const view = heroSettingsTab(
			blankHero({ system: { resources: { highestUnlockedSpellTier: 2 } } }),
			heroContext(),
		);

		expect(settingOf(view, 'spellTier')).toMatchObject({ kind: 'number', value: 2, min: 0 });
		expect(settingOf(view, 'resetSpellTier')).toMatchObject({
			kind: 'button',
			intent: { kind: 'setField', field: 'highestUnlockedSpellTier', value: null },
		});
	});

	it('exports to PDF and to JSON', () => {
		const view = heroSettingsTab(blankHero(), heroContext());

		expect(settingOf(view, 'exportPdf')).toMatchObject({ intent: { kind: 'exportPdf' } });
		expect(settingOf(view, 'exportJson')).toMatchObject({
			label: 'NIMBLE.jsonExport.exportButton',
			intent: { kind: 'exportJson' },
		});
	});

	it('puts Inspiration in Needs a place, with a check box', () => {
		const view = heroSettingsTab(
			blankHero({ system: { resources: { inspiration: true } } }),
			heroContext(),
		);

		expect(view.needsAPlace).toEqual({
			id: 'needsAPlace',
			label: `${SET}.groups.needsAPlace`,
			hint: `${SET}.needsAPlaceHint`,
			settings: [
				{
					kind: 'check',
					id: 'inspiration',
					label: `${SET}.inspiration`,
					on: true,
					target: { kind: 'field', field: 'inspiration' },
				},
			],
		});
	});
});
