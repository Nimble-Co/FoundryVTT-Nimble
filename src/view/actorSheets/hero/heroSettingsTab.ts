import type { HeroIntent, HeroSettingsField, HeroSettingsFlag } from './heroIntent.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';

const SET = 'NIMBLE.actorSheet.hero.settings';

export type HeroSettingTarget =
	| { kind: 'flag'; flag: HeroSettingsFlag }
	| { kind: 'field'; field: HeroSettingsField };

export type HeroSetting =
	| { kind: 'check'; id: string; label: string; on: boolean; target: HeroSettingTarget }
	| {
			kind: 'number';
			id: string;
			label: string;
			hint?: string;
			value: number;
			min?: number;
			target: HeroSettingTarget;
	  }
	| { kind: 'text'; id: string; label: string; value: string; target: HeroSettingTarget }
	| { kind: 'button'; id: string; label: string; icon: string; intent: HeroIntent };

export interface HeroSettingsGroup {
	id: string;
	label: string;
	hint?: string;
	settings: HeroSetting[];
}

export interface HeroSettingsTabView {
	groups: HeroSettingsGroup[];
	/** system data with no place on the sheet yet, with its control */
	needsAPlace: HeroSettingsGroup;
}

const flag = (name: HeroSettingsFlag): HeroSettingTarget => ({ kind: 'flag', flag: name });
const field = (name: HeroSettingsField): HeroSettingTarget => ({ kind: 'field', field: name });

/** The Settings tab as today, with the max wounds bonus, the Initiative bonus and "Needs a place". */
export function heroSettingsTab(
	actor: HeroActorLike,
	context: HeroSheetContext,
): HeroSettingsTabView {
	const { localize, format } = context;
	const { flags, system } = actor;
	const label = (key: string) => localize(`${SET}.${key}`);
	const group = (id: string, settings: HeroSetting[]): HeroSettingsGroup => ({
		id,
		label: label(`groups.${id}`),
		settings,
	});
	const tracking = flags.trackInventorySlots !== false;

	return {
		groups: [
			group('image', [
				{
					kind: 'number',
					id: 'imageX',
					label: label('imageX'),
					value: flags.actorImageXOffset ?? 0,
					target: flag('actorImageXOffset'),
				},
				{
					kind: 'number',
					id: 'imageY',
					label: label('imageY'),
					value: flags.actorImageYOffset ?? 0,
					target: flag('actorImageYOffset'),
				},
				{
					kind: 'number',
					id: 'imageScale',
					label: label('imageScale'),
					value: flags.actorImageScale ?? 100,
					target: flag('actorImageScale'),
				},
			]),
			group('items', [
				{
					kind: 'check',
					id: 'runMacros',
					label: label('runMacros'),
					on: flags.automaticallyExecuteAvailableMacros !== false,
					target: flag('automaticallyExecuteAvailableMacros'),
				},
			]),
			group('inventory', [
				{
					kind: 'check',
					id: 'trackSlots',
					label: label('trackSlots'),
					on: tracking,
					target: flag('trackInventorySlots'),
				},
				...(tracking
					? ([
							{
								kind: 'check',
								id: 'currencyBulk',
								label: label('currencyBulk'),
								on: flags.includeCurrencyBulk !== false,
								target: flag('includeCurrencyBulk'),
							},
							{
								kind: 'number',
								id: 'bonusSlots',
								label: label('bonusSlots'),
								value: system.inventory.bonusSlots,
								min: 0,
								target: field('bonusSlots'),
							},
						] satisfies HeroSetting[])
					: []),
			]),
			group('bonuses', [
				{
					kind: 'number',
					id: 'woundsBonus',
					label: label('woundsBonus'),
					hint: format(`${SET}.maxWounds`, { max: String(system.attributes.wounds.max) }),
					value: system.attributes.wounds.bonus,
					target: field('woundsBonus'),
				},
				{
					kind: 'text',
					id: 'initiativeBonus',
					label: label('initiativeBonus'),
					value: system.attributes.initiative.bonuses,
					target: field('initiativeBonuses'),
				},
			]),
			group('skills', [
				{
					kind: 'check',
					id: 'passiveSkills',
					label: label('passiveSkills'),
					on: flags.showPassiveSkillScores === true,
					target: flag('showPassiveSkillScores'),
				},
			]),
			group('spells', [
				{
					kind: 'number',
					id: 'spellTier',
					label: label('spellTier'),
					value: system.resources.highestUnlockedSpellTier ?? 0,
					min: 0,
					target: field('highestUnlockedSpellTier'),
				},
				{
					kind: 'button',
					id: 'resetSpellTier',
					label: label('resetSpellTier'),
					icon: 'fa-solid fa-rotate-left',
					intent: { kind: 'setField', field: 'highestUnlockedSpellTier', value: null },
				},
			]),
			{
				id: 'export',
				label: localize('NIMBLE.jsonExport.sectionHeader'),
				settings: [
					{
						kind: 'button',
						id: 'exportPdf',
						label: localize('NIMBLE.pdfExport.exportButton'),
						icon: 'fa-solid fa-file-pdf',
						intent: { kind: 'exportPdf' },
					},
					{
						kind: 'button',
						id: 'exportJson',
						label: localize('NIMBLE.jsonExport.exportButton'),
						icon: 'fa-solid fa-file-export',
						intent: { kind: 'exportJson' },
					},
				],
			},
		],
		needsAPlace: {
			id: 'needsAPlace',
			label: label('groups.needsAPlace'),
			hint: label('needsAPlaceHint'),
			settings: [
				{
					kind: 'check',
					id: 'inspiration',
					label: label('inspiration'),
					on: system.resources.inspiration,
					target: field('inspiration'),
				},
			],
		},
	};
}
