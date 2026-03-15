import localize from './localize.js';

export const HEROIC_ACTIONS = ['attack', 'castSpell', 'move', 'assess'] as const;
export const HEROIC_REACTIONS = ['defend', 'interpose', 'opportunityAttack', 'help'] as const;

export type HeroicActionKey = (typeof HEROIC_ACTIONS)[number];
export type HeroicReactionKey = (typeof HEROIC_REACTIONS)[number];
export type HeroicActionCategory = 'heroicAction' | 'heroicReaction';

interface HeroicReactionDefinition {
	labelKey: string;
	availabilityPath: string;
	ownerUsable: boolean;
}

const HEROIC_REACTION_DEFINITIONS = {
	defend: {
		labelKey: 'NIMBLE.ui.heroicActions.reactionLabels.defend',
		availabilityPath: 'system.actions.heroic.defendAvailable',
		ownerUsable: true,
	},
	interpose: {
		labelKey: 'NIMBLE.ui.heroicActions.reactionLabels.interpose',
		availabilityPath: 'system.actions.heroic.interposeAvailable',
		ownerUsable: true,
	},
	opportunityAttack: {
		labelKey: 'NIMBLE.ui.heroicActions.reactionLabels.opportunityAttack',
		availabilityPath: 'system.actions.heroic.opportunityAttackAvailable',
		ownerUsable: true,
	},
	help: {
		labelKey: 'NIMBLE.ui.heroicActions.reactionLabels.help',
		availabilityPath: 'system.actions.heroic.helpAvailable',
		ownerUsable: true,
	},
} as const satisfies Record<HeroicReactionKey, HeroicReactionDefinition>;

export const HEROIC_REACTION_AVAILABILITY_PATHS: Record<HeroicReactionKey, string> =
	Object.fromEntries(
		HEROIC_REACTIONS.map((reactionKey) => [
			reactionKey,
			HEROIC_REACTION_DEFINITIONS[reactionKey].availabilityPath,
		]),
	) as Record<HeroicReactionKey, string>;

export function canOwnerUseHeroicReaction(reactionKey: HeroicReactionKey): boolean {
	return HEROIC_REACTION_DEFINITIONS[reactionKey].ownerUsable;
}

export function getHeroicActionCategoryLabel(category: HeroicActionCategory): string {
	return category === 'heroicAction'
		? localize('NIMBLE.ui.heroicActions.title')
		: localize('NIMBLE.ui.heroicActions.reactionsTitle');
}

export function getHeroicReactionLabel(reactionKey: HeroicReactionKey): string {
	return localize(HEROIC_REACTION_DEFINITIONS[reactionKey].labelKey);
}

export function getHeroicReactionAvailability(
	combatant: Combatant.Implementation,
	reactionKey: HeroicReactionKey,
): boolean {
	const value = foundry.utils.getProperty(
		combatant,
		HEROIC_REACTION_AVAILABILITY_PATHS[reactionKey],
	);
	return typeof value === 'boolean' ? value : true;
}

export function getHeroicReactionAvailabilityUpdate(
	reactionKey: HeroicReactionKey,
	available: boolean,
): Record<string, unknown> {
	return {
		[HEROIC_REACTION_AVAILABILITY_PATHS[reactionKey]]: available,
	};
}

export function getHeroicReactionAvailabilityTitle(
	reactionKey: HeroicReactionKey,
	available: boolean,
): string {
	const label = getHeroicReactionLabel(reactionKey);
	return localize(
		available
			? 'NIMBLE.ui.heroicActions.reactionAvailability.available'
			: 'NIMBLE.ui.heroicActions.reactionAvailability.spent',
		{ label },
	);
}
