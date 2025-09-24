import registerConditionsConfig from './config/registerConditionsConfig.js';
import registerDocumentConfig from './config/registerDocumentConfig.js';
import registerPredicateConfig from './config/registerPredicateConfig.js';
import registerRulesConfig from './config/registerRulesConfig.js';

/** --------------------------------------------- */
/**                 CONSTANTS                     */
/** --------------------------------------------- */
const ROLL_MODE = {
	ADVANTAGE: 1,
	DISADVANTAGE: -1,
	NORMAL: 0,
};

/** --------------------------------------------- */
/**                 CONFIG                        */
/** --------------------------------------------- */

const abilityScores: Record<abilityKey, string> = {
	strength: 'NIMBLE.abilityScores.strength',
	dexterity: 'NIMBLE.abilityScores.dexterity',
	intelligence: 'NIMBLE.abilityScores.intelligence',
	will: 'NIMBLE.abilityScores.will',
};

const abilityScoreAbbreviations: Record<abilityKey, string> = {
	strength: 'NIMBLE.abilityScoreAbbreviations.strength',
	dexterity: 'NIMBLE.abilityScoreAbbreviations.dexterity',
	intelligence: 'NIMBLE.abilityScoreAbbreviations.intelligence',
	will: 'NIMBLE.abilityScoreAbbreviations.will',
};

const activationCostTypes = {
	action: 'NIMBLE.activationCosts.action',
	minute: 'NIMBLE.activationCosts.minute',
	hour: 'NIMBLE.activationCosts.hour',
	none: 'NIMBLE.activationCosts.none',
	special: 'NIMBLE.activationCosts.special',
	turn: 'NIMBLE.activationCosts.turn',
};

const activationCostTypesPlural = {
	action: 'NIMBLE.activationCostsPlural.action',
	minute: 'NIMBLE.activationCostsPlural.minute',
	hour: 'NIMBLE.activationCostsPlural.hour',
	turn: 'NIMBLE.activationCostsPlural.turn',
};

const actorTypeBanners = {
	character: 'systems/nimble/assets/actorTypeBanners/character.webp',
	minion: 'systems/nimble/assets/actorTypeBanners/minion.webp',
	npc: 'systems/nimble/assets/actorTypeBanners/npc.webp',
	soloMonster: 'systems/nimble/assets/actorTypeBanners/soloMonster.webp',
};

const armorTypes = {
	cloth: 'NIMBLE.armorTypes.cloth',
	leather: 'NIMBLE.armorTypes.leather',
	mail: 'NIMBLE.armorTypes.mail',
	plate: 'NIMBLE.armorTypes.plate',
	shield: 'NIMBLE.armorTypes.shield',
};

const armorTypesPlural = {
	leather: 'NIMBLE.armorTypes.leather',
	mail: 'NIMBLE.armorTypes.mail',
	cloth: 'NIMBLE.armorTypes.cloth',
	plate: 'NIMBLE.armorTypes.plate',
	shield: 'NIMBLE.armorTypes.shieldPlural',
};

const boonTypes = {
	minor: 'NIMBLE.boonTypes.minor',
	major: 'NIMBLE.boonTypes.major',
	epic: 'NIMBLE.boonTypes.epic',
};

const classBanners = {
	berserker: 'systems/nimble/assets/classImages/berserker.webp',
	cheat: 'systems/nimble/assets/classImages/cheat.webp',
	commander: 'systems/nimble/assets/classImages/commander.webp',
	hunter: 'systems/nimble/assets/classImages/hunter.webp',
	mage: 'systems/nimble/assets/classImages/mage.webp',
	oathsworn: 'systems/nimble/assets/classImages/oathsworn.webp',
	shadowmancer: 'systems/nimble/assets/classImages/shadowmancer.webp',
	shepherd: 'systems/nimble/assets/classImages/shepherd.webp',
	songweaver: 'systems/nimble/assets/classImages/songweaver.webp',
	stormshifter: 'systems/nimble/assets/classImages/stormshifter.webp',
	zephyr: 'systems/nimble/assets/classImages/zephyr.webp',
};

const classes = {
	berserker: 'NIMBLE.classes.berserker',
	cheat: 'NIMBLE.classes.cheat',
	commander: 'NIMBLE.classes.commander',
	hunter: 'NIMBLE.classes.hunter',
	mage: 'NIMBLE.classes.mage',
	oathsworn: 'NIMBLE.classes.oathsworn',
	shadowmancer: 'NIMBLE.classes.shadowmancer',
	shepherd: 'NIMBLE.classes.shepherd',
	songweaver: 'NIMBLE.classes.songweaver',
	stormshifter: 'NIMBLE.classes.stormshifter',
	zephyr: 'NIMBLE.classes.zephyr',
};

const damageTypes = {
	acid: 'NIMBLE.damageTypes.acid',
	bludgeoning: 'NIMBLE.damageTypes.bludgeoning',
	cold: 'NIMBLE.damageTypes.cold',
	fire: 'NIMBLE.damageTypes.fire',
	force: 'NIMBLE.damageTypes.force',
	lightning: 'NIMBLE.damageTypes.lightning',
	necrotic: 'NIMBLE.damageTypes.necrotic',
	piercing: 'NIMBLE.damageTypes.piercing',
	poison: 'NIMBLE.damageTypes.poison',
	psychic: 'NIMBLE.damageTypes.psychic',
	radiant: 'NIMBLE.damageTypes.radiant',
	slashing: 'NIMBLE.damageTypes.slashing',
	thunder: 'NIMBLE.damageTypes.thunder',
};

const defaultSkillAbilities: Record<skillKey, abilityKey> = {
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
};

const durationTypes = {
	action: 'NIMBLE.durations.action',
	minute: 'NIMBLE.durations.minute',
	hour: 'NIMBLE.durations.hour',
	none: 'NIMBLE.durations.none',
	round: 'NIMBLE.durations.round',
	turn: 'NIMBLE.durations.turn',
	special: 'NIMBLE.durations.special',
};

const durationTypesPlural = {
	action: 'NIMBLE.durationsPlural.action',
	minute: 'NIMBLE.durationsPlural.minute',
	hour: 'NIMBLE.durationsPlural.hour',
	round: 'NIMBLE.durationsPlural.round',
	turn: 'NIMBLE.durationsPlural.turn',
};

const effectApplications = {
	always: 'NIMBLE.effectApplications.always',
	hit: 'NIMBLE.effectApplications.hit',
	miss: 'NIMBLE.effectApplications.miss',
	failedSave: 'NIMBLE.effectApplications.failedSave',
	successfulSave: 'NIMBLE.effectApplications.successfulSave',
} as const;

const effectTypes = {
	condition: 'NIMBLE.effectTypes.condition',
	damage: 'NIMBLE.effectTypes.damage',
	healing: 'NIMBLE.effectTypes.healing',
} as const;

const featureTypeHeadings = {
	ancestry: 'NIMBLE.featureTypeHeadings.ancestry',
	background: 'NIMBLE.featureTypeHeadings.background',
	boon: 'NIMBLE.featureTypeHeadings.boon',
	feature: 'NIMBLE.featureTypeHeadings.feature',
};

const featureTypes = {
	ancestry: 'NIMBLE.featureTypes.ancestry',
	background: 'NIMBLE.featureTypes.background',
	boon: 'NIMBLE.featureTypes.boon',
	class: 'NIMBLE.featureTypes.class',
};

const genericProperties = {
	reach: 'NIMBLE.properties.reach',
	range: 'NIMBLE.properties.range',
};

const healingTypes = {
	healing: 'NIMBLE.healingTypes.healing',
	tempHealing: 'NIMBLE.healingTypes.tempHealing',
};

const languages = {
	common: 'NIMBLE.languages.common',
	dwarvish: 'NIMBLE.languages.dwarvish',
	elvish: 'NIMBLE.languages.elvish',
	goblin: 'NIMBLE.languages.goblin',
	infernal: 'NIMBLE.languages.infernal',
	thievesCant: 'NIMBLE.languages.thievesCant',
	celestial: 'NIMBLE.languages.celestial',
	draconic: 'NIMBLE.languages.draconic',
	primordial: 'NIMBLE.languages.primordial',
	deepSpeak: 'NIMBLE.languages.deepSpeak',
};

const languageHints = {
	common: 'NIMBLE.languageHints.common',
	dwarvish: 'NIMBLE.languageHints.dwarvish',
	elvish: 'NIMBLE.languageHints.elvish',
	goblin: 'NIMBLE.languageHints.goblin',
	infernal: 'NIMBLE.languageHints.infernal',
	thievesCant: 'NIMBLE.languageHints.thievesCant',
	celestial: 'NIMBLE.languageHints.celestial',
	draconic: 'NIMBLE.languageHints.draconic',
	primordial: 'NIMBLE.languageHints.primordial',
	deepSpeak: 'NIMBLE.languageHints.deepSpeak',
};

const languageImages = {
	common: 'icons/environment/people/group.webp',
	dwarvish: 'icons/tools/smithing/crucible.webp',
	elvish: 'icons/weapons/swords/sword-hilt-steel-green.webp',
	goblin: 'icons/creatures/magical/humanoid-silhouette-green.webp',
	infernal: 'icons/creatures/unholy/demon-horned-winged-laughing.webp',
	thievesCant: 'icons/magic/perception/shadow-stealth-eyes-purple.webp',
	celestial: 'icons/magic/holy/angel-winged-humanoid-blue.webp',
	draconic: 'icons/creatures/reptiles/dragon-horned-blue.webp',
	primordial: 'icons/creatures/magical/spirit-fire-orange.webp',
	deepSpeak: 'icons/creatures/slimes/slime-giant-face-eyes.webp',
};

const manaRecoveryTypes = {
	fieldRest: 'NIMBLE.manaRecoveryTypes.fieldRest',
	safeRest: 'NIMBLE.manaRecoveryTypes.safeRest',
	initiative: 'NIMBLE.manaRecoveryTypes.initiative',
};

const monsterFeatureTypes = {
	feature: 'NIMBLE.monsterFeatureTypes.feature',
	action: 'NIMBLE.monsterFeatureTypes.action',
	bloodied: 'NIMBLE.monsterFeatureTypes.bloodied',
	lastStand: 'NIMBLE.monsterFeatureTypes.lastStand',
};

const movementTypes = {
	burrow: 'NIMBLE.movementTypes.burrow',
	climb: 'NIMBLE.movementTypes.climb',
	fly: 'NIMBLE.movementTypes.fly',
	swim: 'NIMBLE.movementTypes.swim',
	walk: 'NIMBLE.movementTypes.walk',
};

const npcArmorEffects = {
	none: 'NIMBLE.armorEffects.none',
	medium: 'NIMBLE.armorEffects.medium',
	heavy: 'NIMBLE.armorEffects.heavy',
};

const npcArmorIcons = {
	none: null,
	medium: 'fa-solid fa-shield-halved',
	heavy: 'fa-solid fa-shield',
};

const npcArmorTypes = {
	none: 'NIMBLE.armorTypes.none',
	medium: 'NIMBLE.armorTypes.medium',
	heavy: 'NIMBLE.armorTypes.heavy',
};

const npcArmorTypeAbbreviations = {
	none: '-',
	medium: 'M',
	heavy: 'H',
};

const objectTypeHeadings = {
	armor: 'NIMBLE.objectTypeHeadings.armor',
	shield: 'NIMBLE.objectTypeHeadings.shield',
	weapon: 'NIMBLE.objectTypeHeadings.weapon',
	consumable: 'NIMBLE.objectTypeHeadings.consumable',
	misc: 'NIMBLE.objectTypeHeadings.misc',
};

const objectTypes = {
	armor: 'NIMBLE.objectTypes.armor',
	shield: 'NIMBLE.objectTypes.shield',
	weapon: 'NIMBLE.objectTypes.weapon',
	consumable: 'NIMBLE.objectTypes.consumable',
	misc: 'NIMBLE.objectTypes.misc',
};

const restTypes = {
	fieldRest: 'NIMBLE.restTypes.fieldRest',
	safeRest: 'NIMBLE.restTypes.safeRest',
};

const savingThrows: Record<saveKey, string> = {
	strength: 'NIMBLE.savingThrows.strength',
	dexterity: 'NIMBLE.savingThrows.dexterity',
	intelligence: 'NIMBLE.savingThrows.intelligence',
	will: 'NIMBLE.savingThrows.will',
};

const savingThrowAbbreviations: Record<saveKey, string> = {
	strength: 'NIMBLE.savingThrowAbbreviations.strength',
	dexterity: 'NIMBLE.savingThrowAbbreviations.dexterity',
	intelligence: 'NIMBLE.savingThrowAbbreviations.intelligence',
	will: 'NIMBLE.savingThrowAbbreviations.will',
};

const sizeCategories = {
	tiny: 'NIMBLE.sizeCategories.tiny',
	small: 'NIMBLE.sizeCategories.small',
	medium: 'NIMBLE.sizeCategories.medium',
	large: 'NIMBLE.sizeCategories.large',
	huge: 'NIMBLE.sizeCategories.huge',
	gargantuan: 'NIMBLE.sizeCategories.gargantuan',
};

const skills: Record<skillKey, string> = {
	arcana: 'NIMBLE.skills.arcana',
	examination: 'NIMBLE.skills.examination',
	influence: 'NIMBLE.skills.influence',
	insight: 'NIMBLE.skills.insight',
	might: 'NIMBLE.skills.might',
	lore: 'NIMBLE.skills.lore',
	naturecraft: 'NIMBLE.skills.naturecraft',
	perception: 'NIMBLE.skills.perception',
	finesse: 'NIMBLE.skills.finesse',
	stealth: 'NIMBLE.skills.stealth',
};

const spellProperties = {
	...genericProperties,
	concentration: 'NIMBLE.properties.concentration',
	utilitySpell: 'NIMBLE.properties.utilitySpell',
};

const spellSchools = {
	fire: 'NIMBLE.spells.schools.fire',
	ice: 'NIMBLE.spells.schools.ice',
	lightning: 'NIMBLE.spells.schools.lightning',
	necrotic: 'NIMBLE.spells.schools.necrotic',
	radiant: 'NIMBLE.spells.schools.radiant',
	wind: 'NIMBLE.spells.schools.wind',
};

const spellSchoolIcons = {
	fire: 'fa-solid fa-fire-flame-curved',
	ice: 'fa-solid fa-snowflake',
	lightning: 'fa-solid fa-bolt-lightning',
	necrotic: 'fa-solid fa-skull',
	radiant: 'fa-solid fa-sun',
	wind: 'fa-solid fa-wind',
};

const spellTiers = {
	0: 'NIMBLE.spells.tiers.tier0',
	1: 'NIMBLE.spells.tiers.tier1',
	2: 'NIMBLE.spells.tiers.tier2',
	3: 'NIMBLE.spells.tiers.tier3',
	4: 'NIMBLE.spells.tiers.tier4',
	5: 'NIMBLE.spells.tiers.tier5',
	6: 'NIMBLE.spells.tiers.tier6',
	7: 'NIMBLE.spells.tiers.tier7',
	8: 'NIMBLE.spells.tiers.tier8',
	9: 'NIMBLE.spells.tiers.tier9',
};

const spellTierHeadings = {
	0: 'NIMBLE.spells.tierHeadings.tier0',
	1: 'NIMBLE.spells.tierHeadings.tier1',
	2: 'NIMBLE.spells.tierHeadings.tier2',
	3: 'NIMBLE.spells.tierHeadings.tier3',
	4: 'NIMBLE.spells.tierHeadings.tier4',
	5: 'NIMBLE.spells.tierHeadings.tier5',
	6: 'NIMBLE.spells.tierHeadings.tier6',
	7: 'NIMBLE.spells.tierHeadings.tier7',
	8: 'NIMBLE.spells.tierHeadings.tier8',
	9: 'NIMBLE.spells.tierHeadings.tier9',
};

const startingHpByHitDieSize = {
	4: 7,
	6: 10,
	8: 13,
	10: 17,
	12: 20,
};

const statArrays = {
	standard: 'NIMBLE.statArrays.standard',
	balanced: 'NIMBLE.statArrays.balanced',
	minMax: 'NIMBLE.statArrays.minMax',
};

const statArrayModifiers = {
	standard: [2, 2, 0, -1],
	balanced: [2, 1, 1, 0],
	minMax: [3, 1, -1, -1],
};

const templateShapes = {
	circle: 'NIMBLE.templateShapes.circle',
	cone: 'NIMBLE.templateShapes.cone',
	emanation: 'NIMBLE.templateShapes.emanation',
	line: 'NIMBLE.templateShapes.line',
	square: 'NIMBLE.templateShapes.square',
};

const timeUnits = {
	action: 'NIMBLE.timeUnits.action',
	day: 'NIMBLE.timeUnits.day',
	hour: 'NIMBLE.timeUnits.hour',
	minute: 'NIMBLE.timeUnits.minute',
	round: 'NIMBLE.timeUnits.round',
	turn: 'NIMBLE.timeUnits.turn',
};

const weaponAttributes = {
	strength: 'NIMBLE.abilityScoreAbbreviations.strength',
	dexterity: 'NIMBLE.abilityScoreAbbreviations.dexterity',
};

const weaponGroups = {
	melee: 'NIMBLE.weaponGroups.melee',
	ranged: 'NIMBLE.weaponGroups.ranged',
};

const weaponProperties = {
	...genericProperties,
	concentration: 'NIMBLE.properties.concentration',
	light: 'NIMBLE.properties.light',
	load: 'NIMBLE.properties.load',
	thrown: 'NIMBLE.properties.thrown',
	twoHanded: 'NIMBLE.properties.twoHanded',
	vicious: 'NIMBLE.properties.vicious',
};

const NIMBLE = {
	// Constants
	ROLL_MODE,

	// Config
	abilityScores,
	abilityScoreAbbreviations,
	activationCostTypes,
	activationCostTypesPlural,
	actorTypeBanners,
	armorTypes,
	armorTypesPlural,
	boonTypes,
	classBanners,
	classes,
	damageTypes,
	defaultSkillAbilities,
	durationTypes,
	durationTypesPlural,
	effectApplications,
	effectTypes,
	featureTypeHeadings,
	featureTypes,
	genericProperties,
	healingTypes,
	languages,
	languageHints,
	languageImages,
	manaRecoveryTypes,
	monsterFeatureTypes,
	movementTypes,
	npcArmorEffects,
	npcArmorIcons,
	npcArmorTypes,
	npcArmorTypeAbbreviations,
	objectTypeHeadings,
	objectTypes,
	restTypes,
	savingThrows,
	savingThrowAbbreviations,
	sizeCategories,
	skills,
	spellProperties,
	spellSchools,
	spellSchoolIcons,
	spellTierHeadings,
	spellTiers,
	startingHpByHitDieSize,
	statArrays,
	statArrayModifiers,
	templateShapes,
	timeUnits,
	weaponAttributes,
	weaponGroups,
	weaponProperties,

	// Register functions
	...registerDocumentConfig(),
	...registerConditionsConfig(),
	...registerRulesConfig(),
	...registerPredicateConfig(),
};

export { NIMBLE };
