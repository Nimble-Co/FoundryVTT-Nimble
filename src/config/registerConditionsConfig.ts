import { SYSTEM_PATH } from '#utils/systemId.ts';

/**
 * Canonical status-effect IDs for system-managed conditions. The keys here are the
 * source of truth — the dictionaries below are typed against this so adding/renaming
 * an ID in one place forces an update in the others.
 */
export const STATUS_EFFECT_IDS = {
	blinded: 'blinded',
	bloodied: 'bloodied',
	charged: 'charged',
	charmed: 'charmed',
	concentration: 'concentration',
	confused: 'confused',
	dazed: 'dazed',
	dead: 'dead',
	despair: 'despair',
	distracted: 'distracted',
	dying: 'dying',
	frightened: 'frightened',
	grappled: 'grappled',
	hampered: 'hampered',
	incapacitated: 'incapacitated',
	invisible: 'invisible',
	lastStand: 'lastStand',
	paralyzed: 'paralyzed',
	petrified: 'petrified',
	poisoned: 'poisoned',
	prone: 'prone',
	restrained: 'restrained',
	riding: 'riding',
	silenced: 'silenced',
	slowed: 'slowed',
	stunned: 'stunned',
	smoldering: 'smoldering',
	taunted: 'taunted',
	unconscious: 'unconscious',
	wounded: 'wounded',
} as const;

export type StatusEffectId = (typeof STATUS_EFFECT_IDS)[keyof typeof STATUS_EFFECT_IDS];

export default function registerConditionsConfig() {
	const conditions: Record<StatusEffectId, string> = {
		blinded: 'NIMBLE.conditions.blinded',
		bloodied: 'NIMBLE.conditions.bloodied',
		charged: 'NIMBLE.conditions.charged',
		charmed: 'NIMBLE.conditions.charmed',
		concentration: 'NIMBLE.conditions.concentration',
		confused: 'NIMBLE.conditions.confused',
		dazed: 'NIMBLE.conditions.dazed',
		dead: 'NIMBLE.conditions.dead',
		despair: 'NIMBLE.conditions.despair',
		distracted: 'NIMBLE.conditions.distracted',
		dying: 'NIMBLE.conditions.dying',
		frightened: 'NIMBLE.conditions.frightened',
		grappled: 'NIMBLE.conditions.grappled',
		hampered: 'NIMBLE.conditions.hampered',
		incapacitated: 'NIMBLE.conditions.incapacitated',
		invisible: 'NIMBLE.conditions.invisible',
		lastStand: 'NIMBLE.conditions.lastStand',
		paralyzed: 'NIMBLE.conditions.paralyzed',
		petrified: 'NIMBLE.conditions.petrified',
		poisoned: 'NIMBLE.conditions.poisoned',
		prone: 'NIMBLE.conditions.prone',
		restrained: 'NIMBLE.conditions.restrained',
		riding: 'NIMBLE.conditions.riding',
		silenced: 'NIMBLE.conditions.silenced',
		slowed: 'NIMBLE.conditions.slowed',
		stunned: 'NIMBLE.conditions.stunned',
		smoldering: 'NIMBLE.conditions.smoldering',
		taunted: 'NIMBLE.conditions.taunted',
		unconscious: 'NIMBLE.conditions.unconscious',
		wounded: 'NIMBLE.conditions.wounded',
	};

	const conditionDescriptions = {
		blinded: 'NIMBLE.conditionDescriptions.blinded',
		bloodied: 'NIMBLE.conditionDescriptions.bloodied',
		charmed: 'NIMBLE.conditionDescriptions.charmed',
		concentration: 'NIMBLE.conditionDescriptions.concentration',
		confused: 'NIMBLE.conditionDescriptions.confused',
		dazed: 'NIMBLE.conditionDescriptions.dazed',
		dead: 'NIMBLE.conditionDescriptions.dead',
		despair: 'NIMBLE.conditionDescriptions.despair',
		dying: 'NIMBLE.conditionDescriptions.dying',
		frightened: 'NIMBLE.conditionDescriptions.frightened',
		grappled: 'NIMBLE.conditionDescriptions.grappled',
		incapacitated: 'NIMBLE.conditionDescriptions.incapacitated',
		invisible: 'NIMBLE.conditionDescriptions.invisible',
		lastStand: 'NIMBLE.conditionDescriptions.lastStand',
		paralyzed: 'NIMBLE.conditionDescriptions.paralyzed',
		petrified: 'NIMBLE.conditionDescriptions.petrified',
		poisoned: 'NIMBLE.conditionDescriptions.poisoned',
		prone: 'NIMBLE.conditionDescriptions.prone',
		restrained: 'NIMBLE.conditionDescriptions.restrained',
		riding: 'NIMBLE.conditionDescriptions.riding',
		silenced: 'NIMBLE.conditionDescriptions.silenced',
		slowed: 'NIMBLE.conditionDescriptions.slowed',
		smoldering: 'NIMBLE.conditionDescriptions.smoldering',
		stunned: 'NIMBLE.conditionDescriptions.stunned',
		taunted: 'NIMBLE.conditionDescriptions.taunted',
		unconscious: 'NIMBLE.conditionDescriptions.unconscious',
		wounded: 'NIMBLE.conditionDescriptions.wounded',
	};

	const conditionDefaultImages: Record<StatusEffectId, string> = {
		blinded: 'icons/svg/blind.svg',
		bloodied: 'icons/svg/blood.svg',
		charged: `${SYSTEM_PATH}/assets/icons/charged.svg`,
		charmed: `${SYSTEM_PATH}/assets/icons/charmed.svg`,
		concentration: `${SYSTEM_PATH}/assets/icons/concentration.svg`,
		confused: `${SYSTEM_PATH}/assets/icons/confused.svg`,
		dazed: `${SYSTEM_PATH}/assets/icons/dazed.svg`,
		dead: 'icons/svg/skull.svg',
		despair: `${SYSTEM_PATH}/assets/icons/despair.svg`,
		distracted: `${SYSTEM_PATH}/assets/icons/distracted.svg`,
		dying: `${SYSTEM_PATH}/assets/icons/dying.svg`,
		frightened: 'icons/svg/terror.svg',
		grappled: `${SYSTEM_PATH}/assets/icons/grappled.svg`,
		hampered: `${SYSTEM_PATH}/assets/icons/hampered.svg`,
		incapacitated: `${SYSTEM_PATH}/assets/icons/incapacitated.svg`,
		invisible: 'icons/svg/invisible.svg',
		lastStand: 'icons/svg/combat.svg',
		paralyzed: 'icons/svg/paralysis.svg',
		petrified: `${SYSTEM_PATH}/assets/icons/petrified.svg`,
		poisoned: 'icons/svg/poison.svg',
		prone: 'icons/svg/falling.svg',
		restrained: 'icons/svg/net.svg',
		riding: `${SYSTEM_PATH}/assets/icons/riding.svg`,
		silenced: `${SYSTEM_PATH}/assets/icons/silenced.svg`,
		slowed: `${SYSTEM_PATH}/assets/icons/slowed.svg`,
		smoldering: 'icons/svg/fire.svg',
		stunned: `${SYSTEM_PATH}/assets/icons/stunned.svg`,
		taunted: `${SYSTEM_PATH}/assets/icons/taunted.svg`,
		unconscious: 'icons/svg/unconscious.svg',
		wounded: `${SYSTEM_PATH}/assets/icons/wound.svg`,
	};

	const conditionAliasedConditions = {
		grappled: ['restrained'] as const,
		incapacitated: ['paralyzed', 'stunned', 'unconscious'] as const,
		paralyzed: ['incapacitated', 'stunned', 'unconscious'] as const,
		restrained: ['grappled'] as const,
		stunned: ['incapacitated', 'restrained', 'paralyzed', 'unconscious'] as const,
		unconscious: ['incapacitated', 'paralyzed', 'stunned'] as const,
	};

	const conditionLinkedConditions = {
		petrified: ['incapacitated'] as const,
	};

	const conditionStackableConditions = new Set(['wounded']);

	const conditionOverlayConditions = new Set(['dead', 'unconscious']);

	// New: Automatic condition trigger relationships
	const conditionTriggerRelationships = {
		hampered: {
			triggeredBy: ['dazed', 'grappled', 'prone', 'slowed', 'restrained'] as const,
			priority: 1,
			stackable: false,
			autoRemove: true,
		},
	} as const;

	return {
		conditions,
		conditionAliasedConditions,
		conditionDescriptions,
		conditionDefaultImages,
		conditionLinkedConditions,
		conditionStackableConditions,
		conditionOverlayConditions,
		conditionTriggerRelationships,
	};
}
