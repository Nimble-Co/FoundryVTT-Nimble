export const HEROIC_ACTIONS = ['attack', 'castSpell', 'move', 'assess'] as const;
export const HEROIC_REACTIONS = ['defend', 'interpose', 'opportunityAttack', 'help'] as const;
export const DEFENDING_CONDITION_ID = 'defending';
export const INTERPOSING_CONDITION_ID = 'interposing';
export const OPPORTUNITY_ATTACKING_CONDITION_ID = 'opportunityAttacking';
export const HELPING_CONDITION_ID = 'helping';

export type HeroicActionKey = (typeof HEROIC_ACTIONS)[number];
export type HeroicReactionKey = (typeof HEROIC_REACTIONS)[number];
export type HeroicActionCategory = 'heroicAction' | 'heroicReaction';

const OWNER_USABLE_HEROIC_REACTIONS = new Set<HeroicReactionKey>([
	'defend',
	'interpose',
	'opportunityAttack',
	'help',
]);

export const HEROIC_ACTION_CATEGORY_LABELS: Record<HeroicActionCategory, string> = {
	heroicAction: 'Heroic Actions',
	heroicReaction: 'Heroic Reactions',
};

export const HEROIC_REACTION_LABELS: Record<HeroicReactionKey, string> = {
	defend: 'Defend',
	interpose: 'Interpose',
	opportunityAttack: 'Opportunity Attack',
	help: 'Help',
};

export const HEROIC_REACTION_AVAILABILITY_PATHS: Record<HeroicReactionKey, string> = {
	defend: 'system.actions.heroic.defendAvailable',
	interpose: 'system.actions.heroic.interposeAvailable',
	opportunityAttack: 'system.actions.heroic.opportunityAttackAvailable',
	help: 'system.actions.heroic.helpAvailable',
};

export function canOwnerUseHeroicReaction(reactionKey: HeroicReactionKey): boolean {
	return OWNER_USABLE_HEROIC_REACTIONS.has(reactionKey);
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
