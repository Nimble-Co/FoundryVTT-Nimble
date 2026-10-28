import type {
	HeroActorLike,
	HeroCombatState,
	HeroSheetContext,
} from '../../../src/view/actorSheets/hero/heroSource.ts';
import type { ItemLike } from '../../../src/view/actorSheets/shared/sheetSource.ts';
import { createLocalizerStub } from './localizerStub.ts';

type DeepPartial<T> = T extends unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: DeepPartial<T[K]> }
		: T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Objects merge key by key; arrays and other values replace. */
function merge<T>(base: T, overrides: DeepPartial<T> | undefined): T {
	if (!overrides) return base;
	const out = { ...base } as Record<string, unknown>;
	for (const [key, value] of Object.entries(overrides)) {
		const current = out[key];
		out[key] = isPlainObject(current) && isPlainObject(value) ? merge(current, value) : value;
	}
	return out as T;
}

const rolled = (mod: number, defaultRollMode = 0) => ({ mod, defaultRollMode });

export function heroItem(overrides: Partial<ItemLike> & Pick<ItemLike, 'type'>): ItemLike {
	return {
		id: `${overrides.type}0000000001`,
		name: overrides.type,
		img: 'icons/svg/item-bag.svg',
		system: {},
		rules: [],
		...overrides,
	};
}

/**
 * A level 1 Berserker with no features, spells or gear: the book's key stats (STR, DEX),
 * saves (STR+, INT-), Hit Die (d12) and starting HP (20).
 */
export function blankHero(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero: HeroActorLike = {
		id: 'blankHero00000001',
		name: 'Blank Hero',
		img: 'icons/svg/mystery-man.svg',
		system: {
			abilities: {
				strength: rolled(2),
				dexterity: rolled(2),
				intelligence: rolled(-1),
				will: rolled(0),
			},
			savingThrows: {
				strength: rolled(2, 1),
				dexterity: rolled(2),
				intelligence: rolled(-1, -1),
				will: rolled(0),
			},
			skills: {
				arcana: rolled(-1),
				examination: rolled(-1),
				finesse: rolled(2),
				influence: rolled(0),
				insight: rolled(0),
				lore: rolled(-1),
				might: rolled(2),
				naturecraft: rolled(0),
				perception: rolled(0),
				stealth: rolled(2),
			},
			attributes: {
				hp: { value: 20, max: 20, temp: 0 },
				wounds: { value: 0, max: 6 },
				armor: { value: 2 },
				initiative: rolled(2),
				movement: { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 },
				sizeCategory: 'medium',
				hitDice: { '12': { current: 1 } },
				bonusHitDice: [],
				hitDiceSizeBonus: 0,
				damageResistances: [],
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			proficiencies: { languages: ['common'], armor: [], weapons: ['All STR Weapons'] },
			resources: { mana: { current: 0, max: 0, baseMax: 0 } },
			levelUpHistory: [],
			conditionImmunities: [],
		},
		flags: {},
		items: [
			heroItem({
				id: 'classBerserker01',
				type: 'class',
				name: 'Berserker',
				system: { identifier: 'berserker', classLevel: 1, hitDieSize: 12, mana: { formula: '' } },
			}),
			heroItem({ id: 'ancestryHuman001', type: 'ancestry', name: 'Human' }),
		],
		effects: [],
	};
	return merge<HeroActorLike>(hero, overrides);
}

/** A combat where the hero rolled Initiative and it is their turn with 3 actions. */
export function heroTurn(overrides?: DeepPartial<HeroCombatState>): HeroCombatState {
	return merge<HeroCombatState>(
		{
			initiativeRolled: true,
			initiativePending: false,
			isTurn: true,
			actions: { current: 3, effectiveMax: 3, pendingDelta: 0 },
		},
		overrides,
	);
}

/** Out of combat, with the stub localizer of the view-model tests. */
export function heroContext(overrides?: Partial<HeroSheetContext>): HeroSheetContext {
	return {
		...createLocalizerStub(),
		combat: null,
		manaFromInitiative: false,
		missingLevelSelections: [],
		labels: {
			conditions: {},
			damageTypes: { fire: 'Fire', cold: 'Cold', poison: 'Poison' },
			languages: { common: 'Common' },
			armorTypes: { leather: 'Leather', mail: 'Mail', shield: 'Shields' },
		},
		skillAbilities: {
			arcana: 'intelligence',
			examination: 'intelligence',
			finesse: 'dexterity',
			influence: 'will',
			insight: 'will',
			might: 'strength',
			lore: 'intelligence',
			naturecraft: 'will',
			perception: 'will',
			stealth: 'dexterity',
		},
		dicePools: [],
		chargePools: [],
		...overrides,
	};
}
