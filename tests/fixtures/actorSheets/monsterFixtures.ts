import type {
	MonsterActorLike,
	MonsterItemLike,
	MonsterSheetContext,
} from '../../../src/view/actorSheets/monster/monsterSource.ts';
import { conditionLike, type DeepPartial, effectLike, merge } from './heroFixtures.ts';
import { createLocalizerStub } from './localizerStub.ts';

type Subtype = 'feature' | 'action' | 'attackSequence' | 'bloodied' | 'lastStand';

interface AbilityOptions {
	description?: string;
	/** a damage roll: the ability opens the roll window */
	damage?: string;
	attackType?: 'reach' | 'range';
	distance?: number;
	parentItemId?: string;
	img?: string;
}

/** A `monsterFeature` item. An ability with `damage` has an activation effect, so it rolls. */
export function monsterAbility(
	actorId: string,
	id: string,
	name: string,
	subtype: Subtype,
	sort: number,
	options: AbilityOptions = {},
): MonsterItemLike {
	const effects = options.damage
		? [{ id: `${id}Damage`, type: 'damage', formula: options.damage, damageType: 'bludgeoning' }]
		: [];
	return {
		id,
		uuid: `Actor.${actorId}.Item.${id}`,
		name,
		img: options.img ?? 'icons/svg/sword.svg',
		type: 'monsterFeature',
		sort,
		system: {
			subtype,
			description: options.description ?? '',
			parentItemId: options.parentItemId ?? '',
			activation: {
				effects,
				targets: options.attackType
					? { attackType: options.attackType, distance: options.distance ?? 1 }
					: { attackType: '', distance: 1 },
			},
		},
		rules: [],
	};
}

const save = (mod: number, defaultRollMode = 0) => ({ mod, defaultRollMode });

function baseMonster(id: string): MonsterActorLike {
	return {
		id,
		name: id,
		img: 'icons/svg/mystery-man.svg',
		type: 'npc',
		system: {
			savingThrows: {
				strength: save(0),
				dexterity: save(0),
				intelligence: save(0),
				will: save(0),
			},
			attributes: {
				hp: { value: 10, max: 10, temp: 0 },
				armor: 'none',
				movement: { walk: 6, fly: 0, climb: 0, swim: 0, burrow: 0 },
				sizeCategory: 'medium',
				damageResistances: [],
				damageImmunities: [],
				damageVulnerabilities: [],
			},
			conditionImmunities: [],
			details: { level: '1', creatureType: '', isFlunky: false },
			description: '',
			currency: { cp: 0, sp: 0, gp: 0 },
		},
		flags: {},
		items: [],
		effects: [],
	};
}

/** The Goblin of the GM guide: level 1/3, Small, 15 HP, a feature and two attacks. */
export function goblin(overrides?: DeepPartial<MonsterActorLike>): MonsterActorLike {
	const id = 'goblin0000000001';
	const monster = baseMonster(id);
	monster.name = 'Goblin';
	monster.system.attributes.hp = { value: 15, max: 15, temp: 0 };
	monster.system.attributes.sizeCategory = 'small';
	monster.system.details = { level: '1/3', creatureType: 'Goblins', isFlunky: false };
	monster.system.description =
		'<p>Green, cunning, and thriving on the edge of chaos. Will mock you mercilessly if given the chance.</p>';
	monster.items = [
		monsterAbility(id, 'hahaMissedMe0001', 'Haha, Missed Me!', 'feature', 100000, {
			description: '<p>Whenever an attack misses you, deal 1 psychic damage in return.</p>',
		}),
		monsterAbility(id, 'stab000000000001', 'Stab', 'action', 100000, {
			description: '<p>1d6+2.</p>',
			damage: '1d6+2',
		}),
		monsterAbility(id, 'shoot00000000001', 'Shoot', 'action', 200000, {
			description: '<p>1d6+2.</p>',
			damage: '1d6+2',
			attackType: 'range',
			distance: 8,
		}),
	];
	return merge<MonsterActorLike>(monster, overrides);
}

/**
 * Pudge the Blunderer, the legendary monster example of the GM guide: level 2 Solo, 75 HP,
 * Medium armor, STR+ and INT-, two actions in an attack sequence, Bloodied at 37 HP and a Last Stand.
 */
export function soloMonster(overrides?: DeepPartial<MonsterActorLike>): MonsterActorLike {
	const id = 'pudge00000000001';
	const monster = baseMonster(id);
	monster.name = 'Pudge the Blunderer';
	monster.type = 'soloMonster';
	monster.system.attributes.hp = { value: 75, max: 75, temp: 0 };
	monster.system.attributes.armor = 'medium';
	monster.system.attributes.sizeCategory = 'large';
	monster.system.savingThrows.strength = save(0, 1);
	monster.system.savingThrows.intelligence = save(0, -1);
	monster.system.details = { level: '2', creatureType: 'Ogre', isFlunky: false };
	const sequence = 'sequence00000001';
	monster.items = [
		monsterAbility(id, sequence, 'Actions', 'attackSequence', 100000, {
			description: '<p>After each hero’s turn, choose one:</p>',
		}),
		monsterAbility(id, 'moveAndSmack0001', 'Move & Smack', 'action', 200000, {
			description: '<p>Move 8, attack for 1d8+2. On damage: Prone.</p>',
			damage: '1d8+2',
			parentItemId: sequence,
		}),
		monsterAbility(id, 'grabAndThrow0001', 'Grab & Throw', 'action', 300000, {
			description:
				'<p>1d8+2, on damage: they are thrown at another hero within 6 spaces. Both make a DC 12 DEX save or take 1d8+2 damage and are knocked Prone, half damage on save.</p>',
			damage: '1d8+2',
			parentItemId: sequence,
		}),
		monsterAbility(id, 'bloodied00000001', 'Bloodied', 'bloodied', 100000, {
			description: '<p>At 37 HP, Pudge’s damage increases to 1d12+2.</p>',
		}),
		monsterAbility(id, 'lastStand0000001', 'Last Stand', 'lastStand', 100000, {
			description:
				'<p>Pudge is dying! 20 more damage and he dies. Until then, Pudge can move 6 spaces, and use Grab & Throw each turn.</p>',
		}),
	];
	return merge<MonsterActorLike>(monster, overrides);
}

/** The Kobold Minion: level 1/4, Small, no HP (a minion), a feature and one attack. */
export function minion(overrides?: DeepPartial<MonsterActorLike>): MonsterActorLike {
	const id = 'koboldMinion0001';
	const monster = baseMonster(id);
	monster.name = 'Kobold Minion';
	monster.type = 'minion';
	monster.system.attributes.hp = { value: 1, max: 1, temp: 0 };
	monster.system.attributes.sizeCategory = 'small';
	monster.system.details = { level: '1/4', creatureType: 'Kobolds', isFlunky: false };
	monster.items = [
		monsterAbility(id, 'nooooo0000000001', 'Nooooo!', 'feature', 100000, {
			description: '<p>When an ally within 2 spaces dies, attack once for free.</p>',
		}),
		monsterAbility(id, 'koboldStab000001', 'Stab', 'action', 100000, {
			description: '<p>1d4 (follows minion rules).</p>',
			damage: '1d4',
		}),
	];
	return merge<MonsterActorLike>(monster, overrides);
}

export function monsterContext(overrides?: Partial<MonsterSheetContext>): MonsterSheetContext {
	return {
		...createLocalizerStub(),
		editable: true,
		labels: {
			conditions: { dazed: 'Dazed', frightened: 'Frightened', prone: 'Prone' },
			damageTypes: { fire: 'Fire', poison: 'Poison', psychic: 'Psychic', cold: 'Cold' },
			sizes: { small: 'Small', medium: 'Medium', large: 'Large' },
		},
		conditions: [
			conditionLike({ id: 'dazed', name: 'Dazed' }),
			conditionLike({ id: 'frightened', name: 'Frightened' }),
			conditionLike({ id: 'prone', name: 'Prone' }),
		],
		itemPools: {},
		enrichedNotes: '',
		enrichedDescriptions: {},
		importCredit: '',
		...overrides,
	};
}

/** The Goblin with a timed effect, a passive effect of its own and Dazed on. */
export function effectsMonster(overrides?: DeepPartial<MonsterActorLike>): MonsterActorLike {
	const monster = goblin();
	monster.effects = [
		effectLike({ id: 'bless', name: 'Bless', duration: '3 rounds', description: 'Add 1d4.' }),
		effectLike({ id: 'thickHide', name: 'Thick Hide', temporary: false }),
		effectLike({ id: 'dazedEffect', name: 'Dazed', statuses: ['dazed'] }),
	];
	return merge<MonsterActorLike>(monster, overrides);
}

export function effectsMonsterContext(
	overrides?: Partial<MonsterSheetContext>,
): MonsterSheetContext {
	const context = monsterContext();
	return monsterContext({
		conditions: context.conditions.map((condition) =>
			condition.id === 'dazed' ? { ...condition, active: true, source: 'Dazed' } : condition,
		),
		...overrides,
	});
}
