export const HEROIC_ACTIONS = ['attack', 'castSpell', 'move', 'assess'] as const;
export const HEROIC_REACTIONS = ['defend', 'interpose', 'opportunityAttack', 'help'] as const;
export const DEFENDING_CONDITION_ID = 'defending';
export const INTERPOSING_CONDITION_ID = 'interposing';
export const OPPORTUNITY_ATTACKING_CONDITION_ID = 'opportunityAttacking';
export const HELPING_CONDITION_ID = 'helping';

export type HeroicActionKey = (typeof HEROIC_ACTIONS)[number];
export type HeroicReactionKey = (typeof HEROIC_REACTIONS)[number];
export type HeroicActionCategory = 'heroicAction' | 'heroicReaction';

interface HeroicReactionDefinition {
	label: string;
	availabilityPath: string;
	ownerUsable: boolean;
	sideEffectConditionId?: string;
}

const HEROIC_REACTION_DEFINITIONS = {
	defend: {
		label: 'Defend',
		availabilityPath: 'system.actions.heroic.defendAvailable',
		ownerUsable: true,
		sideEffectConditionId: DEFENDING_CONDITION_ID,
	},
	interpose: {
		label: 'Interpose',
		availabilityPath: 'system.actions.heroic.interposeAvailable',
		ownerUsable: true,
		sideEffectConditionId: INTERPOSING_CONDITION_ID,
	},
	opportunityAttack: {
		label: 'Opportunity Attack',
		availabilityPath: 'system.actions.heroic.opportunityAttackAvailable',
		ownerUsable: true,
		sideEffectConditionId: OPPORTUNITY_ATTACKING_CONDITION_ID,
	},
	help: {
		label: 'Help',
		availabilityPath: 'system.actions.heroic.helpAvailable',
		ownerUsable: true,
		sideEffectConditionId: HELPING_CONDITION_ID,
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

const HEROIC_REACTION_SIDE_EFFECT_CONDITION_IDS = HEROIC_REACTIONS.reduce<string[]>(
	(sideEffectIds, reactionKey) => {
		const sideEffectConditionId = HEROIC_REACTION_DEFINITIONS[reactionKey].sideEffectConditionId;
		if (sideEffectConditionId) sideEffectIds.push(sideEffectConditionId);
		return sideEffectIds;
	},
	[],
);

export function canOwnerUseHeroicReaction(reactionKey: HeroicReactionKey): boolean {
	return HEROIC_REACTION_DEFINITIONS[reactionKey].ownerUsable;
}

export function getHeroicReactionSideEffectConditionId(
	reactionKey: HeroicReactionKey,
): string | null {
	return HEROIC_REACTION_DEFINITIONS[reactionKey].sideEffectConditionId ?? null;
}

export function getHeroicReactionSideEffectConditionIds(): readonly string[] {
	return HEROIC_REACTION_SIDE_EFFECT_CONDITION_IDS;
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
