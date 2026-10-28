import localize from '../localize.js';

export const HEROIC_ACTIONS = ['attack', 'castSpell', 'move', 'assess'] as const;
export const HEROIC_REACTIONS = ['defend', 'interpose', 'opportunityAttack', 'help'] as const;

export type HeroicActionKey = (typeof HEROIC_ACTIONS)[number];
export type HeroicReactionKey = (typeof HEROIC_REACTIONS)[number];
export type HeroicActionCategory = 'heroicAction' | 'heroicReaction';

interface BuiltInHeroicDefinition {
	/** The id that `HeroicAction` drag data and hotbar macro commands carry. */
	actionId: string;
	icon: string;
	labelKey: string;
	descriptionKey: string;
}

export interface BuiltInHeroicAction extends BuiltInHeroicDefinition {
	actionType: 'action';
}

export interface BuiltInHeroicReaction extends BuiltInHeroicDefinition {
	actionType: 'reaction';
	reactionKey: HeroicReactionKey;
}

export const BUILT_IN_HEROIC_ACTIONS: readonly BuiltInHeroicAction[] = [
	{
		actionId: 'attack',
		actionType: 'action',
		icon: 'fa-solid fa-sword',
		labelKey: 'NIMBLE.ui.heroicActions.actions.attack.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.attack.description',
	},
	{
		actionId: 'unarmedStrike',
		actionType: 'action',
		icon: 'fa-solid fa-hand-fist',
		labelKey: 'NIMBLE.ui.heroicActions.unarmedStrike',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.unarmedStrike.description',
	},
	{
		actionId: 'spell',
		actionType: 'action',
		icon: 'fa-solid fa-wand-sparkles',
		labelKey: 'NIMBLE.ui.heroicActions.actions.spell.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.spell.description',
	},
	{
		actionId: 'move',
		actionType: 'action',
		icon: 'fa-solid fa-person-running',
		labelKey: 'NIMBLE.ui.heroicActions.actions.move.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.move.description',
	},
	{
		actionId: 'assess',
		actionType: 'action',
		icon: 'fa-solid fa-eye',
		labelKey: 'NIMBLE.ui.heroicActions.actions.assess.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.actions.assess.description',
	},
];

export const BUILT_IN_HEROIC_REACTIONS: readonly BuiltInHeroicReaction[] = [
	{
		actionId: 'defend',
		actionType: 'reaction',
		icon: 'fa-solid fa-shield',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.defend.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.defend.description',
		reactionKey: 'defend',
	},
	{
		actionId: 'interpose',
		actionType: 'reaction',
		icon: 'fa-solid fa-people-arrows',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.interpose.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.interpose.description',
		reactionKey: 'interpose',
	},
	{
		actionId: 'opportunity',
		actionType: 'reaction',
		icon: 'fa-solid fa-bullseye',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.opportunity.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.opportunity.description',
		reactionKey: 'opportunityAttack',
	},
	{
		actionId: 'help',
		actionType: 'reaction',
		icon: 'fa-solid fa-handshake-angle',
		labelKey: 'NIMBLE.ui.heroicActions.reactions.help.label',
		descriptionKey: 'NIMBLE.ui.heroicActions.reactions.help.description',
		reactionKey: 'help',
	},
];

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

export function getHeroicReactionLabelKey(reactionKey: HeroicReactionKey): string {
	return HEROIC_REACTION_DEFINITIONS[reactionKey].labelKey;
}

export function getHeroicReactionLabel(reactionKey: HeroicReactionKey): string {
	return localize(getHeroicReactionLabelKey(reactionKey));
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

export function getAllHeroicReactionAvailabilityUpdate(
	available: boolean,
): Record<string, unknown> {
	const update: Record<string, unknown> = {};
	for (const reactionKey of HEROIC_REACTIONS) {
		Object.assign(update, getHeroicReactionAvailabilityUpdate(reactionKey, available));
	}
	return update;
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
