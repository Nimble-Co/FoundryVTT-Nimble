import type { MonsterIntent, MonsterSettingsFlag } from './monsterIntent.ts';
import type { MonsterActorLike, MonsterSheetContext } from './monsterSource.ts';

const SET = 'NIMBLE.actorSheet.monster.settings';
const COINS = ['gp', 'sp', 'cp'];

/** The intent that saves a new value of a setting. */
type SetIntent<T> = (value: T) => MonsterIntent;

export type MonsterSetting =
	| { kind: 'value'; id: string; label: string; value: string }
	| { kind: 'check'; id: string; label: string; on: boolean; intent: SetIntent<boolean> }
	| {
			kind: 'number';
			id: string;
			label: string;
			value: number;
			min?: number;
			/** you type it out of edit mode too */
			always?: boolean;
			intent: SetIntent<number>;
	  };

export interface MonsterSettingsGroup {
	id: string;
	label: string;
	settings: MonsterSetting[];
}

export interface MonsterSettingsTabView {
	groups: MonsterSettingsGroup[];
}

const flag =
	(name: MonsterSettingsFlag) =>
	(value: boolean | number): MonsterIntent => ({ kind: 'setFlag', flag: name, value });

/** The Settings tab: what the monster is (read only), the image settings, item macros and coins. */
export function monsterSettingsTab(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): MonsterSettingsTabView {
	const { localize, format } = context;
	const { flags, system } = actor;
	const label = (key: string) => localize(`${SET}.${key}`);
	const group = (id: string, settings: MonsterSetting[]): MonsterSettingsGroup => ({
		id,
		label: label(`groups.${id}`),
		settings,
	});
	const value = (id: string, text: string): MonsterSetting => ({
		kind: 'value',
		id,
		label: label(id),
		value: text,
	});

	return {
		groups: [
			group('monster', [
				value('monsterType', localize(`TYPES.Actor.${actor.type}`)),
				value('level', system.details.level),
				value('size', context.labels.sizes[system.attributes.sizeCategory] ?? ''),
				value('creatureType', system.details.creatureType),
			]),
			group('image', [
				{
					kind: 'number',
					id: 'imageX',
					label: label('imageX'),
					value: flags.actorImageXOffset ?? 0,
					intent: flag('actorImageXOffset'),
				},
				{
					kind: 'number',
					id: 'imageY',
					label: label('imageY'),
					value: flags.actorImageYOffset ?? 0,
					intent: flag('actorImageYOffset'),
				},
				{
					kind: 'number',
					id: 'imageScale',
					label: label('imageScale'),
					value: flags.actorImageScale ?? 100,
					intent: flag('actorImageScale'),
				},
			]),
			group('items', [
				{
					kind: 'check',
					id: 'runMacros',
					label: label('runMacros'),
					on: flags.automaticallyExecuteAvailableMacros !== false,
					intent: flag('automaticallyExecuteAvailableMacros'),
				},
			]),
			group(
				'coins',
				COINS.map((coin) => ({
					kind: 'number',
					id: `coin-${coin}`,
					label: format(`${SET}.coin`, {
						coin: localize(`NIMBLE.currencyAbbreviations.${coin}`),
					}),
					value: Number(system.currency[coin] ?? 0),
					min: 0,
					always: true,
					intent: (amount: number): MonsterIntent => ({ kind: 'setCurrency', coin, value: amount }),
				})),
			),
		],
	};
}
