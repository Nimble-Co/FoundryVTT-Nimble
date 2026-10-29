import type {
	HeroActorLike,
	HeroCombatState,
	HeroItemState,
	HeroSheetContext,
} from '../../../src/view/actorSheets/hero/heroSource.ts';
import type {
	ConditionLike,
	EffectLike,
	ItemLike,
} from '../../../src/view/actorSheets/shared/sheetSource.ts';
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
	const id = overrides.id ?? `${overrides.type}0000000001`;
	return {
		id,
		uuid: `Actor.blankHero00000001.Item.${id}`,
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
				wounds: { value: 0, max: 6, bonus: 0 },
				armor: { value: 2 },
				initiative: { ...rolled(2), bonuses: '' },
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
			resources: {
				mana: { current: 0, max: 0, baseMax: 0 },
				highestUnlockedSpellTier: null,
				inspiration: false,
			},
			levelUpHistory: [],
			conditionImmunities: [],
			currency: { cp: 0, sp: 0, gp: 0 },
			inventory: { totalSlots: 10, usedSlots: 0, bonusSlots: 0, containerCapacityUsage: {} },
			details: { age: '', height: '', weight: '', gender: '', notes: '' },
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
			actions: { current: 3, effectiveMax: 3, pendingDelta: 0, mayAdd: true },
			reactionsSpent: [],
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
			spellSchools: { fire: 'Fire', ice: 'Ice', lightning: 'Lightning', radiant: 'Radiant' },
			featureGroups: { 'savage-arsenal': 'Savage Arsenal' },
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
		conditions: [],
		dicePools: [],
		chargePools: [],
		itemState: {},
		targets: [],
		unarmedDamage: '1+STR',
		enrichedNotes: '',
		...overrides,
	};
}

const rule = (id: string, type: string, fields: Record<string, unknown> = {}) => ({
	id,
	type,
	active: true,
	fields: { type, ...fields },
});

interface CostOptions {
	type?: string;
	quantity?: number;
	isReaction?: boolean;
	details?: string;
}

const activation = (cost: CostOptions = {}, effects: unknown[] = [], targets = {}) => ({
	cost: { type: 'action', quantity: 1, isReaction: false, details: '', ...cost },
	effects,
	targets: { count: 1, restrictions: '', ...targets },
});

const damage = (formula: string, damageType: string) => ({ type: 'damage', formula, damageType });

export function weaponItem(
	id: string,
	name: string,
	options: {
		equipped?: boolean;
		properties?: string[];
		formula?: string;
		attackType?: string;
	} = {},
): ItemLike {
	return heroItem({
		id,
		type: 'object',
		name,
		system: {
			objectType: 'weapon',
			equipped: options.equipped ?? true,
			description: { public: '' },
			properties: {
				selected: options.properties ?? [],
				range: { min: 2, max: 8 },
				reach: { min: 1, max: null },
			},
			activation: activation({}, [damage(options.formula ?? '1d8+@strength', 'slashing')], {
				attackType: options.attackType ?? 'reach',
			}),
		},
	});
}

export function spellItem(
	id: string,
	name: string,
	options: {
		tier?: number;
		school?: string;
		selected?: string[];
		damage?: [string, string];
		cost?: CostOptions;
		description?: string;
	} = {},
): ItemLike {
	return heroItem({
		id,
		type: 'spell',
		name,
		system: {
			tier: options.tier ?? 0,
			school: options.school ?? 'fire',
			description: { baseEffect: options.description ?? '', higherLevelEffect: '' },
			properties: {
				selected: options.selected ?? ['range'],
				range: { min: 2, max: 8 },
				reach: { min: 1, max: null },
			},
			activation: activation(options.cost, options.damage ? [damage(...options.damage)] : []),
		},
	});
}

export function featureItem(
	id: string,
	name: string,
	options: { cost?: CostOptions; rules?: ItemLike['rules']; description?: string } = {},
): ItemLike {
	return heroItem({
		id,
		type: 'feature',
		name,
		system: {
			featureType: 'class',
			description: options.description ?? '',
			activation: activation({ type: 'none', ...options.cost }),
		},
		rules: options.rules ?? [],
	});
}

/** A level 1 Mage with 3 mana, a staff and the spells of two schools. */
export function manaCaster(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero = blankHero({
		id: 'manaCaster0000001',
		name: 'Mana Caster',
		system: { resources: { mana: { current: 3, max: 3, baseMax: 3 } } },
	});
	hero.items = [
		heroItem({
			id: 'classMage0000001',
			type: 'class',
			name: 'Mage',
			system: { identifier: 'mage', classLevel: 1, hitDieSize: 6, mana: { formula: '@int' } },
		}),
		heroItem({ id: 'ancestryElf0001', type: 'ancestry', name: 'Elf' }),
		weaponItem('staff', 'Staff', { formula: '1d6+@strength' }),
		spellItem('flameDart', 'Flame Dart', {
			damage: ['1d10', 'fire'],
			description: '<p>Deal fire damage to a creature in range.</p>',
		}),
		spellItem('ignite', 'Ignite', { tier: 1, damage: ['4d10', 'fire'], cost: { quantity: 2 } }),
		spellItem('iceLance', 'Ice Lance', { school: 'ice', damage: ['1d6', 'cold'] }),
		spellItem('frostShield', 'Frost Shield', {
			tier: 1,
			school: 'ice',
			selected: [],
			cost: { isReaction: true, details: 'When attacked' },
		}),
		spellItem('chillcraft', 'Chillcraft', { tier: 1, school: 'ice', selected: ['utilitySpell'] }),
	];
	return merge<HeroActorLike>(hero, overrides);
}

/** A level 3 Berserker with Fury Dice: Rage turns on, Bloodlust spends dice, Blood Frenzy raises one die. */
export function dicePoolHero(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero = blankHero({ id: 'dicePoolHero00001', name: 'Dice Pool Hero' });
	hero.items = [
		...hero.items,
		weaponItem('greataxe', 'Greataxe', { formula: '2d6+@strength', properties: ['twoHanded'] }),
		weaponItem('javelin', 'Javelin', {
			equipped: false,
			properties: ['range'],
			attackType: 'range',
		}),
		featureItem('rage', 'Rage', {
			cost: { type: 'action', quantity: 1 },
			rules: [rule('rageToggle', 'toggleEffect')],
			description: '<p>Enter a rage.</p>',
		}),
		featureItem('bloodlust', 'Bloodlust', {
			rules: [rule('bloodlustDice', 'diceConsumer', { mode: 'manual', poolIdentifier: 'fury' })],
		}),
		featureItem('bloodFrenzy', 'Blood Frenzy', {
			rules: [
				rule('frenzyDice', 'diceConsumer', {
					mode: 'manual',
					poolIdentifier: 'fury',
					selectionOutcome: 'maximize',
				}),
			],
		}),
		featureItem('thatAllYouGot', 'That all you got?!', {
			cost: { type: 'action', isReaction: true, details: 'when you are attacked' },
		}),
		featureItem('passiveFeature', 'Unstoppable'),
	];
	return merge<HeroActorLike>(hero, overrides);
}

/** The pools and states of `dicePoolHero` that the system works out. */
export function dicePoolContext(overrides?: Partial<HeroSheetContext>): HeroSheetContext {
	return heroContext({
		dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [5, 6] }],
		itemState: {
			greataxe: itemState({ actionCost: 1 }),
			rage: itemState({ actionCost: 1, toggle: { ruleId: 'rageToggle', on: false } }),
			bloodlust: itemState({
				diceConsumers: [
					{
						ruleId: 'bloodlustDice',
						poolId: 'fury',
						label: 'Bloodlust',
						cap: null,
						maximize: false,
					},
				],
			}),
			bloodFrenzy: itemState({
				diceConsumers: [
					{ ruleId: 'frenzyDice', poolId: 'fury', label: 'Blood Frenzy', cap: 1, maximize: true },
				],
			}),
			thatAllYouGot: itemState({ actionCost: 1 }),
		},
		...overrides,
	});
}

export function itemState(overrides: Partial<HeroItemState> = {}): HeroItemState {
	return { actionCost: 0, pools: [], gate: null, toggle: null, diceConsumers: [], ...overrides };
}

export function objectItem(
	id: string,
	name: string,
	options: {
		objectType?: string;
		quantity?: number;
		containerId?: string;
		equipped?: boolean;
		capacity?: number | null;
		rules?: ItemLike['rules'];
		description?: string;
	} = {},
): ItemLike {
	return heroItem({
		id,
		type: 'object',
		name,
		system: {
			objectType: options.objectType ?? 'misc',
			quantity: options.quantity ?? 1,
			containerId: options.containerId ?? '',
			equipped: options.equipped ?? false,
			description: { public: options.description ?? '' },
			container:
				options.capacity === undefined
					? { enabled: false, capacity: null, requiresEquipped: false }
					: { enabled: true, capacity: options.capacity, requiresEquipped: false },
			activation: activation({ type: 'none' }),
		},
		rules: options.rules ?? [],
	});
}

/**
 * A level 1 Berserker with a backpack (rope and rations in it, 6 of 10 used), an empty pouch,
 * a sword, armor, a shield, potions and torches, and coins.
 */
export function containerHero(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero = blankHero({
		id: 'containerHero0001',
		name: 'Container Hero',
		system: {
			currency: { cp: 30, sp: 4, gp: 12 },
			inventory: {
				totalSlots: 13,
				usedSlots: 9,
				containerCapacityUsage: { backpack: 6, pouch: 0 },
			},
		},
	});
	hero.items = [
		...hero.items,
		weaponItem('longsword', 'Longsword'),
		objectItem('leather', 'Leather Armor', { objectType: 'armor', equipped: true }),
		objectItem('shield', 'Wooden Shield', { objectType: 'shield' }),
		objectItem('potion', 'Healing Potion', { objectType: 'consumable', quantity: 2 }),
		objectItem('torch', 'Torch', { quantity: 3 }),
		objectItem('backpack', 'Backpack', { capacity: 10 }),
		objectItem('pouch', 'Pouch', { capacity: 2 }),
		objectItem('rope', 'Rope', { containerId: 'backpack' }),
		objectItem('rations', 'Rations', {
			objectType: 'consumable',
			quantity: 5,
			containerId: 'backpack',
		}),
	];
	return merge<HeroActorLike>(hero, overrides);
}

/**
 * A level 3 Berserker with class features of levels 1 to 3, a subclass, a selection group,
 * an exotic ancestry with a bonus, a background and a boon.
 */
export function featureHero(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero = blankHero({ id: 'featureHero000001', name: 'Feature Hero' });
	const feature = (
		id: string,
		name: string,
		system: Record<string, unknown>,
		options: Parameters<typeof featureItem>[2] = {},
	) => {
		const item = featureItem(id, name, options);
		item.system = { ...item.system, ...system };
		return item;
	};
	hero.items = [
		heroItem({ id: 'classBerserker01', type: 'class', name: 'Berserker' }),
		heroItem({ id: 'subclassRedMist', type: 'subclass', name: 'Path of the Red Mist' }),
		feature('rage', 'Rage', { group: 'berserker-progression', gainedAtLevel: 1 }),
		feature('intensifyingFury', 'Intensifying Fury', { group: 'ungrouped', gainedAtLevel: 1 }),
		feature('quickTempered', 'Quick Tempered', { group: 'ungrouped', gainedAtLevel: 2 }),
		feature('bloodlust', 'Bloodlust', { subclass: true, gainedAtLevel: 3 }),
		feature('mightyEndurance', 'Mighty Endurance', {
			group: 'savage-arsenal',
			gainedAtLevels: [2, 4],
		}),
		feature('deathlessRage', 'Deathless Rage', { group: 'savage-arsenal', gainedAtLevel: 2 }),
		heroItem({
			id: 'ancestryDragonborn',
			type: 'ancestry',
			name: 'Dragonborn',
			system: { exotic: true },
		}),
		heroItem({ id: 'bonusBreath', type: 'ancestryBonus', name: 'Draconic Breath' }),
		heroItem({ id: 'backgroundSoldier', type: 'background', name: 'Soldier' }),
		heroItem({ id: 'boonLuck', type: 'boon', name: 'Boon of Luck', system: { boonType: 'major' } }),
	];
	return merge<HeroActorLike>(hero, overrides);
}

export function effectLike(
	overrides: Partial<EffectLike> & Pick<EffectLike, 'id' | 'name'>,
): EffectLike {
	return {
		img: 'icons/svg/aura.svg',
		disabled: false,
		statuses: [],
		origin: null,
		itemId: null,
		toggle: null,
		temporary: true,
		duration: '',
		description: '',
		...overrides,
	};
}

export function conditionLike(
	overrides: Partial<ConditionLike> & Pick<ConditionLike, 'id' | 'name'>,
): ConditionLike {
	return {
		img: `icons/conditions/${overrides.id}.svg`,
		active: false,
		description: '',
		duration: '',
		source: '',
		...overrides,
	};
}

/**
 * The Effects tab of `dicePoolHero` with Rage on (it ends after 1 round with no attack), a timed
 * Bless, an armor effect from equipped Leather Armor, a hand-made passive effect, and Dazed on.
 */
export function effectsContext(overrides?: Partial<HeroSheetContext>): HeroSheetContext {
	return dicePoolContext({
		labels: { ...heroContext().labels, conditions: { dazed: 'Dazed', prone: 'Prone' } },
		conditions: [
			conditionLike({
				id: 'dazed',
				name: 'Dazed',
				active: true,
				source: 'Dazed',
				description: 'You lose 1 action.',
			}),
			conditionLike({ id: 'prone', name: 'Prone' }),
		],
		...overrides,
	});
}

export function effectsHero(overrides?: DeepPartial<HeroActorLike>): HeroActorLike {
	const hero = dicePoolHero();
	const rage = hero.items.find((item) => item.id === 'rage')!;
	rage.rules = [rule('rageToggle', 'toggleEffect', { endAfterInactiveRounds: 1 })];
	hero.items.push(objectItem('leather', 'Leather Armor', { objectType: 'armor', equipped: true }));
	hero.effects = [
		effectLike({
			id: 'rageEffect',
			name: 'Rage',
			toggle: { itemId: 'rage', ruleId: 'rageToggle' },
		}),
		effectLike({ id: 'bless', name: 'Bless', duration: '3 rounds', description: 'Add 1d4.' }),
		effectLike({ id: 'armorEffect', name: 'Armor', itemId: 'leather', temporary: false }),
		effectLike({ id: 'blessing', name: 'Old Blessing', temporary: false }),
		effectLike({ id: 'dazedEffect', name: 'Dazed', statuses: ['dazed'] }),
	];
	return merge<HeroActorLike>(hero, overrides);
}
