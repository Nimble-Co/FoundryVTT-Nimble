import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface ReactionPanelProps {
	actor: NimbleCharacter;
	reactionDisabled?: boolean;
	combinedReactionDisabled?: boolean;
	defendSpent?: boolean;
	interposeSpent?: boolean;
	helpSpent?: boolean;
	opportunitySpent?: boolean;
	noActions?: boolean;
	onUseReaction?: (options?: { force?: boolean }) => Promise<boolean>;
	onUseCombinedReaction?: (options?: { force?: boolean }) => Promise<boolean>;
}

export interface OpportunityAttackPanelProps extends ReactionPanelProps {
	showEmbeddedDocumentImages?: boolean;
}
