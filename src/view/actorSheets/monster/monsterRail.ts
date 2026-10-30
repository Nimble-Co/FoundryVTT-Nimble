import type { SaveKeyType } from '#types/saveKey.js';
import { MOVEMENT_ICONS, MOVEMENT_ORDER } from '../shared/movement.ts';
import { portraitOf } from '../shared/portrait.ts';
import { signedNumber } from '../shared/signedNumber.ts';
import type { MonsterArmor, MonsterConfigureTarget, MonsterIntent } from './monsterIntent.ts';
import type { MonsterActorLike, MonsterSheetContext } from './monsterSource.ts';

const RAIL = 'NIMBLE.actorSheet.monster.rail';
const SAVES: SaveKeyType[] = ['strength', 'dexterity', 'intelligence', 'will'];
const ARMOR_SHORT: Record<MonsterArmor, string> = { none: '-', medium: 'M', heavy: 'H' };
const ARMORS = Object.keys(ARMOR_SHORT) as MonsterArmor[];

export interface MonsterSaveView {
	key: SaveKeyType;
	label: string;
	mod: string;
	advantage: number;
	intent: MonsterIntent;
}

export interface MonsterStatView {
	id: string;
	label: string;
	icon: string;
	value: string | number;
	tooltip: string;
}

export interface MonsterDefenseView {
	id: 'resist' | 'immune' | 'vulnerable';
	label: string;
	value: string;
}

/** Edit mode: a quiet outline that opens a configure window. */
export interface MonsterOutline {
	short: string;
	label: string;
	intent: MonsterIntent;
}

export interface MonsterRailView {
	text: {
		label: string;
		hp: string;
		tempHp: string;
		minion: string;
		changePortrait: string;
		name: string;
		/** edit mode shows the defenses box when it is empty, so you can configure it */
		noDefenses: string;
	};
	/** the Edit switch */
	edit: { label: string; startHint: string; stopHint: string };
	/** the outlines of edit mode; null: the user cannot change the monster */
	configure: Record<'metadata' | 'saves' | 'movement' | 'defenses', MonsterOutline | null>;
	name: string;
	/** "Level 1/3 Small Goblins", "Level 2 Solo Large Ogre" */
	meta: string;
	img: string;
	portrait: { x: number; y: number; scale: number };
	/** null for a minion: it has no HP */
	hp: {
		value: number;
		max: number;
		temp: number;
		/** "Bloodied" at half HP or less; null otherwise */
		state: string | null;
		tooltip: string;
	} | null;
	/** the minion rules, in place of the HP */
	minionRules: string[] | null;
	saves: MonsterSaveView[];
	/** armor, then each speed */
	stats: MonsterStatView[];
	/** the armor select of edit mode */
	armor: { value: MonsterArmor; label: string; options: { value: MonsterArmor; label: string }[] };
	/** only the defenses that the monster has */
	defenses: MonsterDefenseView[];
}

function meta(actor: MonsterActorLike, context: MonsterSheetContext): string {
	const { level, creatureType, isFlunky } = actor.system.details;
	const size = context.labels.sizes[actor.system.attributes.sizeCategory] ?? '';
	const kind = actor.type === 'npc' && isFlunky ? 'flunky' : actor.type;
	return context
		.format(`${RAIL}.meta.${kind}`, { level, size, type: creatureType })
		.replace(/\s+/g, ' ')
		.trim();
}

/** The speeds that the monster has; walking when it has none. */
function speeds(actor: MonsterActorLike, context: MonsterSheetContext): MonsterStatView[] {
	const { movement } = actor.system.attributes;
	const shown = MOVEMENT_ORDER.filter((type) => (movement[type] ?? 0) > 0);
	return (shown.length ? shown : ['walk']).map((type) => {
		const value = movement[type] ?? 0;
		return {
			id: type,
			label: context.localize(`${RAIL}.speed.${type}`),
			icon: MOVEMENT_ICONS[type],
			value,
			tooltip: context.format(`${RAIL}.speedTooltip`, {
				type: context.localize(`NIMBLE.movementTypes.${type}`),
				value: String(value),
			}),
		};
	});
}

function defenses(actor: MonsterActorLike, context: MonsterSheetContext): MonsterDefenseView[] {
	const { attributes, conditionImmunities } = actor.system;
	const { damageTypes, conditions } = context.labels;
	const names = (keys: string[], labels: Record<string, string>) =>
		keys.map((key) => labels[key] ?? key);
	const lines: [MonsterDefenseView['id'], string[]][] = [
		['resist', names(attributes.damageResistances, damageTypes)],
		[
			'immune',
			[
				...names(attributes.damageImmunities, damageTypes),
				...names(conditionImmunities, conditions),
			],
		],
		['vulnerable', names(attributes.damageVulnerabilities, damageTypes)],
	];
	return lines
		.filter(([, values]) => values.length > 0)
		.map(([id, values]) => ({
			id,
			label: context.localize(`${RAIL}.defenses.${id}`),
			value: values.join(', '),
		}));
}

function outlines(context: MonsterSheetContext): MonsterRailView['configure'] {
	const { localize, editable } = context;
	const outline = (short: string, label: string, target: MonsterConfigureTarget) =>
		editable
			? {
					short: localize(`${RAIL}.${short}`),
					label: localize(label),
					intent: { kind: 'configure', target } as const,
				}
			: null;
	return {
		metadata: outline('metaShort', `${RAIL}.metaLabel`, 'metadata'),
		saves: outline('savesShort', 'NIMBLE.prompts.configureSavingThrows', 'saves'),
		movement: outline('movementShort', 'NIMBLE.prompts.configureMovement', 'movement'),
		// the monster window holds the damage defenses, as on the old sheet
		defenses: outline('defensesShort', 'NIMBLE.npcSheet.editDamageDefenses', 'metadata'),
	};
}

/** The rail of the NPC sheet (the header of the narrow form): who, HP, saves, armor, speed, defenses. */
export function monsterRail(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): MonsterRailView {
	const { localize, format } = context;
	const { hp, armor } = actor.system.attributes;
	const minion = actor.type === 'minion';
	const bloodied = !minion && hp.value > 0 && hp.value <= hp.max / 2;
	const armorKey: MonsterArmor = ARMORS.includes(armor as MonsterArmor)
		? (armor as MonsterArmor)
		: 'none';
	const armorName = localize(`NIMBLE.armorTypes.${armorKey}`);

	return {
		text: {
			label: localize(`${RAIL}.label`),
			hp: localize('NIMBLE.actorSheet.parts.vitalPlate.hp'),
			tempHp: localize('NIMBLE.actorSheet.parts.vitalPlate.tempHp'),
			minion: localize(`${RAIL}.minion.label`),
			changePortrait: localize('NIMBLE.prompts.changeActorImage'),
			name: localize(`${RAIL}.name`),
			noDefenses: localize(`${RAIL}.noDefenses`),
		},
		edit: {
			label: localize(`${RAIL}.edit`),
			startHint: localize(`${RAIL}.editHint`),
			stopHint: localize(`${RAIL}.stopEditing`),
		},
		configure: outlines(context),
		name: actor.name,
		meta: meta(actor, context),
		img: actor.img,
		portrait: portraitOf(actor.flags),
		hp: minion
			? null
			: {
					value: hp.value,
					max: hp.max,
					temp: hp.temp,
					state: bloodied ? localize('NIMBLE.conditions.bloodied') : null,
					tooltip: localize(`${RAIL}.hp.${bloodied ? 'bloodied' : 'healthy'}`),
				},
		minionRules: minion
			? [localize(`${RAIL}.minion.noHp`), localize(`${RAIL}.minion.noCrit`)]
			: null,
		saves: SAVES.map((key) => {
			const save = actor.system.savingThrows[key] ?? { mod: 0, defaultRollMode: 0 };
			return {
				key,
				label: localize(`NIMBLE.savingThrowAbbreviations.${key}`),
				mod: signedNumber(save.mod),
				advantage: save.defaultRollMode,
				intent: { kind: 'rollSave', save: key },
			};
		}),
		stats: [
			{
				id: 'armor',
				label: localize(`${RAIL}.armor`),
				icon: 'fa-solid fa-shield-halved',
				value: ARMOR_SHORT[armorKey],
				tooltip: format(`${RAIL}.armorTooltip`, { armor: armorName }),
			},
			...speeds(actor, context),
		],
		armor: {
			value: armorKey,
			label: localize(`${RAIL}.armor`),
			options: ARMORS.map((value) => ({ value, label: localize(`NIMBLE.armorTypes.${value}`) })),
		},
		defenses: defenses(actor, context),
	};
}
