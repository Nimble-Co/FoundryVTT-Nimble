import type { NimbleCharacter } from '../../src/documents/actor/actor';

export interface ReactionPanelProps {
	actor: NimbleCharacter;
	inCombat?: boolean;
	actionsRemaining?: number;
	onDeductAction?: () => Promise<void>;
}

export interface OpportunityReactionPanelProps extends ReactionPanelProps {
	showEmbeddedDocumentImages?: boolean;
}
