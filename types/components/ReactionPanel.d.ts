import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface ReactionPanelStateOptions {
	getActor: () => NimbleCharacter;
	getReactionDisabled: () => boolean;
	getDefendSpent: () => boolean;
	getInterposeSpent: () => boolean;
	getNoActions: () => boolean;
	getIsActiveTurn: () => boolean;
	getCombinedIsActiveTurn: () => boolean;
	getOnUseReaction: () => (options?: {
		force?: boolean;
		skipActionDeduction?: boolean;
	}) => Promise<boolean>;
	getCombinedReactionDisabled: () => boolean;
	getOnUseCombinedReaction: () => (options?: {
		force?: boolean;
		skipActionDeduction?: boolean;
	}) => Promise<boolean>;
}

export interface ReactionPanelProps {
	actor: NimbleCharacter;
	reactionDisabled?: boolean;
	combinedReactionDisabled?: boolean;
	defendSpent?: boolean;
	interposeSpent?: boolean;
	helpSpent?: boolean;
	opportunitySpent?: boolean;
	noActions?: boolean;
	isActiveTurn?: boolean;
	combinedIsActiveTurn?: boolean;
	onUseReaction?: (options?: {
		force?: boolean;
		skipActionDeduction?: boolean;
	}) => Promise<boolean>;
	onUseCombinedReaction?: (options?: {
		force?: boolean;
		skipActionDeduction?: boolean;
	}) => Promise<boolean>;
}

export interface OpportunityAttackPanelProps extends ReactionPanelProps {
	showEmbeddedDocumentImages?: boolean;
	forceNextReactionUse?: boolean;
	onConsumeForcedReactionUse?: () => void;
}
