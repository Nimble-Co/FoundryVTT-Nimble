import { signedNumber } from '../shared/signedNumber.ts';
import type { HeroIntent } from './heroIntent.ts';
import type { HeroActorLike, HeroSheetContext } from './heroSource.ts';
import { shownMovementTypes, speedBonuses } from './heroSpeed.ts';

export interface HeroRollView {
	mod: string;
	/** stacked advantage (positive) or disadvantage (negative) */
	rollMode: number;
	intent: HeroIntent;
}

export interface HeroAbilityView {
	key: string;
	abbreviation: string;
	name: string;
	check: HeroRollView;
	save: HeroRollView;
}

export interface HeroSkillView extends HeroRollView {
	key: string;
	name: string;
	ability: string;
	abilityAbbreviation: string;
	/** 10 + the modifier, behind the passive scores flag */
	passive: string | null;
}

export interface HeroProficiencyView {
	label: string;
	value: string;
	/** a short note after the value: where a bonus comes from */
	note: string | null;
	configure: HeroIntent | null;
}

export interface HeroCoreView {
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
			configure: { kind: 'configure', target: 'movement' },
		},
		{
			label: localize(`${CORE}.languages`),
			value: listOrNone(languages.map((key) => labels.languages[key] ?? key).sort(byName), context),
			note: null,
			configure: { kind: 'configure', target: 'languages' },
		},
		{
			label: localize(`${CORE}.armor`),
			value: listOrNone(armor.map((key) => labels.armorTypes[key] ?? key).sort(byName), context),
			note: null,
			configure: { kind: 'configure', target: 'armorProficiencies' },
		},
		{
			label: localize(`${CORE}.weapons`),
			value: listOrNone([...weapons], context),
			note: null,
			configure: { kind: 'configure', target: 'weaponProficiencies' },
		},
		{
			label: localize(`${CORE}.damage`),
			value: damageDefenses(actor, context),
			note: null,
			configure: { kind: 'configure', target: 'damageDefenses' },
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
	const { localize } = context;
	const { abilities, savingThrows, skills } = actor.system;
	const showPassive = actor.flags.showPassiveSkillScores === true;

	return {
		abilities: Object.entries(abilities).map(([key, ability]) => {
			const save = savingThrows[key] ?? { mod: 0, defaultRollMode: 0 };
			return {
				key,
				abbreviation: localize(`NIMBLE.abilityScoreAbbreviations.${key}`),
				name: localize(`NIMBLE.abilityScores.${key}`),
				check: {
					mod: signedNumber(ability.mod),
					rollMode: ability.defaultRollMode,
					intent: { kind: 'rollAbilityCheck', ability: key },
				},
				save: {
					mod: signedNumber(save.mod),
					rollMode: save.defaultRollMode,
					intent: { kind: 'rollSave', save: key },
				},
			};
		}),
		skills: Object.entries(skills)
			.map(([key, skill]) => {
				const ability = context.skillAbilities[key] ?? '';
				return {
					key,
					name: localize(`NIMBLE.skills.${key}`),
					ability,
					abilityAbbreviation: ability
						? localize(`NIMBLE.abilityScoreAbbreviations.${ability}`)
						: '',
					mod: signedNumber(skill.mod),
					rollMode: skill.defaultRollMode,
					passive: showPassive ? String(10 + skill.mod) : null,
					intent: { kind: 'rollSkill', skill: key } as HeroIntent,
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name)),
		proficiencies: proficiencies(actor, context),
	};
}
