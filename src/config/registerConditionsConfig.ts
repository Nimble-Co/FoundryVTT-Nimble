export default function registerConditionsConfig() {
	const conditions = {
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

	const conditionDefaultImages = {
		blinded: 'icons/svg/blind.svg',
		bloodied: 'icons/svg/blood.svg',
		charged: 'systems/nimble/assets/icons/charged.svg',
		charmed: 'systems/nimble/assets/icons/charmed.svg',
		concentration: 'systems/nimble/assets/icons/concentration.svg',
		confused: 'systems/nimble/assets/icons/confused.svg',
		dazed: 'systems/nimble/assets/icons/dazed.svg',
		dead: 'icons/svg/skull.svg',
		despair: 'systems/nimble/assets/icons/despair.svg',
		distracted: 'systems/nimble/assets/icons/distracted.svg',
		dying: 'systems/nimble/assets/icons/dying.svg',
		frightened: 'icons/svg/terror.svg',
		grappled: 'systems/nimble/assets/icons/grappled.svg',
		hampered: 'systems/nimble/assets/icons//hampered.svg',
		incapacitated: 'systems/nimble/assets/icons/incapacitated.svg',
		invisible: 'icons/svg/invisible.svg',
		paralyzed: 'icons/svg/paralysis.svg',
		petrified: 'systems/nimble/assets/icons/petrified.svg',
		poisoned: 'icons/svg/poison.svg',
		prone: 'icons/svg/falling.svg',
		restrained: 'icons/svg/net.svg',
		riding: 'systems/nimble/assets/icons/riding.svg',
		silenced: 'systems/nimble/assets/icons/silenced.svg',
		slowed: 'systems/nimble/assets/icons/slowed.svg',
		smoldering: 'icons/svg/fire.svg',
		stunned: 'systems/nimble/assets/icons/stunned.svg',
		taunted: 'systems/nimble/assets/icons/taunted.svg',
		unconscious: 'icons/svg/unconscious.svg',
		wounded: 'systems/nimble/assets/icons/wound.svg',
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
