import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
import { type RollModeView, rollModeView } from '../shared/rollModeView.ts';
import { signedNumber } from '../shared/signedNumber.ts';
import type { HeroConfigureTarget, HeroIntent } from './heroIntent.ts';
import type { HeroActorLike, HeroSheetContext, RolledValue } from './heroSource.ts';
import { shownMovementTypes, speedBonuses } from './heroSpeed.ts';

export interface HeroRollView {
	mod: string;
	rollMode: RollModeView | null;
	/** what the roll button says to a screen reader and in its tooltip */
	label: string;
	intent: HeroIntent;
}

export interface HeroAbilityView {
	key: AbilityKeyType;
	abbreviation: string;
	name: string;
	check: HeroRollView;
	save: HeroRollView;
}

export interface HeroSkillView extends HeroRollView {
	key: SkillKeyType;
	name: string;
	ability: AbilityKeyType | null;
	abilityAbbreviation: string;
	/** 10 + the modifier, behind the passive scores flag */
	passive: string | null;
}

export interface HeroProficiencyView {
	label: string;
	value: string;
	/** a short note after the value: where a bonus comes from */
	note: string | null;
	configure: { intent: HeroIntent; label: string } | null;
}

export interface HeroCoreView {
	text: {
		abilitiesAndSaves: string;
		/** the short name on the button */
		stats: string;
		/** the long label of that button */
		configureStats: string;
		saves: string;
		configureSaves: string;
		/** the word before a save modifier */
		save: string;
		skills: string;
		configureSkills: string;
		proficiencies: string;
	};
	abilities: HeroAbilityView[];
	skills: HeroSkillView[];
	proficiencies: HeroProficiencyView[];
}

const CORE = 'NIMBLE.actorSheet.hero.core';

function speedBonusNote(actor: HeroActorLike, context: HeroSheetContext): string | null {
	const notes = speedBonuses(actor).map((bonus) =>
		context.format(`${CORE}.speedBonus`, {
			amount: signedNumber(bonus.amount),
			source: bonus.source,
		}),
	);
	return notes.length ? notes.join(', ') : null;
}

function configureButton(
	target: HeroConfigureTarget,
	labelKey: string,
	context: HeroSheetContext,
): HeroProficiencyView['configure'] {
	return {
		intent: { kind: 'configure', target },
		label: context.localize(labelKey),
	};
}

function listOrNone(names: string[], context: HeroSheetContext): string {
	return names.length ? names.join(', ') : context.localize(`${CORE}.none`);
}

function damageDefenses(actor: HeroActorLike, context: HeroSheetContext): string {
	const { attributes } = actor.system;
	const name = (type: string) => context.labels.damageTypes[type] ?? type;
	const lines = [
		['NIMBLE.npcDefenses.resistant', attributes.damageResistances],
		['NIMBLE.npcDefenses.immune', attributes.damageImmunities],
		['NIMBLE.npcDefenses.vulnerable', attributes.damageVulnerabilities],
	] as const;
	const parts = lines
		.filter(([, types]) => types.length > 0)
		.map(([label, types]) =>
			context.format(`${CORE}.defense`, {
				label: context.localize(label),
				types: types.map(name).join(', '),
			}),
		);
	return parts.length ? parts.join('; ') : context.localize(`${CORE}.none`);
}

function proficiencies(actor: HeroActorLike, context: HeroSheetContext): HeroProficiencyView[] {
	const { localize, format, labels } = context;
	const { movement } = actor.system.attributes;
	const { languages, armor, weapons } = actor.system.proficiencies;
	const byName = (a: string, b: string) => a.localeCompare(b);

	const speed = shownMovementTypes(actor)
		.map((type) =>
			format(`${CORE}.speedValue`, {
				type: localize(`NIMBLE.movementTypes.${type}`),
				value: String(movement[type] ?? 0),
			}),
		)
		.join(', ');

	const rows: HeroProficiencyView[] = [
		{
			label: localize(`${CORE}.speed`),
			value: speed,
			note: speedBonusNote(actor, context),
			configure: configureButton('movement', 'NIMBLE.prompts.configureMovement', context),
		},
		{
			label: localize(`${CORE}.languages`),
			value: listOrNone(languages.map((key) => labels.languages[key] ?? key).sort(byName), context),
			note: null,
			configure: configureButton(
				'languages',
				'NIMBLE.prompts.configureLanguageProficiencies',
				context,
			),
		},
		{
			label: localize(`${CORE}.armor`),
			value: listOrNone(armor.map((key) => labels.armorTypes[key] ?? key).sort(byName), context),
			note: null,
			configure: configureButton(
				'armorProficiencies',
				'NIMBLE.prompts.configureArmorProficiencies',
				context,
			),
		},
		{
			label: localize(`${CORE}.weapons`),
			value: listOrNone([...weapons], context),
			note: null,
			configure: configureButton(
				'weaponProficiencies',
				'NIMBLE.prompts.configureWeaponProficiencies',
				context,
			),
		},
		{
			label: localize(`${CORE}.damage`),
			value: damageDefenses(actor, context),
			note: null,
			configure: configureButton(
				'damageDefenses',
				'NIMBLE.prompts.configureDamageDefenses',
				context,
			),
		},
	];

	const immunities = actor.system.conditionImmunities;
	if (immunities.length) {
		rows.push({
			label: localize(`${CORE}.conditions`),
			value: immunities
				.map((id) => labels.conditions[id] ?? id)
				.sort(byName)
				.join(', '),
			note: null,
			configure: null,
		});
	}
	return rows;
}

/** The Core tab: abilities and saves, skills, and the proficiencies and defenses. */
export function heroCoreTab(actor: HeroActorLike, context: HeroSheetContext): HeroCoreView {
	const { localize, format } = context;
	const { abilities, savingThrows, skills } = actor.system;
	const showPassive = actor.flags.showPassiveSkillScores === true;

	return {
		text: {
			abilitiesAndSaves: localize(`${CORE}.abilitiesAndSaves`),
			stats: localize(`${CORE}.stats`),
			configureStats: localize('NIMBLE.prompts.configureAbilityScores'),
			saves: localize(`${CORE}.saves`),
			configureSaves: localize('NIMBLE.prompts.configureSavingThrows'),
			save: localize(`${CORE}.save`),
			skills: localize(`${CORE}.skills`),
			configureSkills: localize('NIMBLE.prompts.configureSkills'),
			proficiencies: localize(`${CORE}.proficiencies`),
		},
		abilities: (Object.entries(abilities) as [AbilityKeyType, RolledValue][]).map(
			([key, ability]) => {
				const save = savingThrows[key] ?? { mod: 0, defaultRollMode: 0 };
				const name = localize(`NIMBLE.abilityScores.${key}`);
				return {
					key,
					abbreviation: localize(`NIMBLE.abilityScoreAbbreviations.${key}`),
					name,
					check: {
						mod: signedNumber(ability.mod),
						rollMode: rollModeView(ability.defaultRollMode, format),
						label: format('NIMBLE.prompts.rollAbilityCheckSpecific', { ability: name }),
						intent: { kind: 'rollAbilityCheck', ability: key },
					},
					save: {
						mod: signedNumber(save.mod),
						rollMode: rollModeView(save.defaultRollMode, format),
						label: format('NIMBLE.prompts.rollSavingThrowSpecific', { save: name }),
						intent: { kind: 'rollSave', save: key },
					},
				};
			},
		),
		skills: (Object.entries(skills) as [SkillKeyType, RolledValue][])
			.map(([key, skill]): HeroSkillView => {
				const ability = context.skillAbilities[key] ?? null;
				const name = localize(`NIMBLE.skills.${key}`);
				return {
					key,
					name,
					ability,
					abilityAbbreviation: ability
						? localize(`NIMBLE.abilityScoreAbbreviations.${ability}`)
						: '',
					mod: signedNumber(skill.mod),
					rollMode: rollModeView(skill.defaultRollMode, format),
					label: format('NIMBLE.prompts.rollSkillCheckSpecific', { skill: name }),
					passive: showPassive ? String(10 + skill.mod) : null,
					intent: { kind: 'rollSkill', skill: key },
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name)),
		proficiencies: proficiencies(actor, context),
	};
}
