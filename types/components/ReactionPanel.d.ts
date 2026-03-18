import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface ReactionPanelProps {
	actor: NimbleCharacter;
	reactionDisabled?: boolean;
	combinedReactionDisabled?: boolean;
	onUseReaction?: () => Promise<boolean>;
	onUseCombinedReaction?: () => Promise<boolean>;
}

export interface OpportunityAttackPanelProps extends ReactionPanelProps {
	showEmbeddedDocumentImages?: boolean;
}
