export const HEROIC_ACTIONS = ['attack', 'castSpell', 'move', 'assess'] as const;
export const HEROIC_REACTIONS = ['defend', 'interpose', 'opportunityAttack', 'help'] as const;

export type HeroicActionKey = (typeof HEROIC_ACTIONS)[number];
export type HeroicReactionKey = (typeof HEROIC_REACTIONS)[number];
export type HeroicActionCategory = 'heroicAction' | 'heroicReaction';

interface HeroicReactionDefinition {
	label: string;
	availabilityPath: string;
	ownerUsable: boolean;
}

const HEROIC_REACTION_DEFINITIONS = {
	defend: {
		label: 'Defend',
		availabilityPath: 'system.actions.heroic.defendAvailable',
		ownerUsable: true,
	},
	interpose: {
		label: 'Interpose',
		availabilityPath: 'system.actions.heroic.interposeAvailable',
		ownerUsable: true,
	},
	opportunityAttack: {
		label: 'Opportunity Attack',
		availabilityPath: 'system.actions.heroic.opportunityAttackAvailable',
		ownerUsable: true,
	},
	help: {
		label: 'Help',
		availabilityPath: 'system.actions.heroic.helpAvailable',
		ownerUsable: true,
	},
} as const satisfies Record<HeroicReactionKey, HeroicReactionDefinition>;

export const HEROIC_ACTION_CATEGORY_LABELS: Record<HeroicActionCategory, string> = {
	heroicAction: 'Heroic Actions',
	heroicReaction: 'Heroic Reactions',
};

export const HEROIC_REACTION_LABELS: Record<HeroicReactionKey, string> = Object.fromEntries(
	HEROIC_REACTIONS.map((reactionKey) => [
		reactionKey,
		HEROIC_REACTION_DEFINITIONS[reactionKey].label,
	]),
) as Record<HeroicReactionKey, string>;

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
	const label = HEROIC_REACTION_LABELS[reactionKey];
	return `${label} ${available ? 'available' : 'spent'}`;
}
