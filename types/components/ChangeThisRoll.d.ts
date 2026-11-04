import type { createChangeThisRollState } from '../../src/view/chat/components/ChangeThisRoll.svelte.ts';
import type { DieOutcome } from '#utils/incomingReactions/incomingReactionEntry.ts';
import type { PrimaryDieBonusLine } from '../primaryDieBonus.d.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionPicking,
	IncomingReactionText,
} from './IncomingReactionPrompts.d.ts';

export interface ChangeThisRollProps {
	control: ReturnType<typeof createChangeThisRollState>;
	/** The rows this user can click, by actor. */
	groups: IncomingReactionActorGroup[];
	/** The reroll or change whose choice shows under its row. */
	picking: IncomingReactionPicking | null;
	busy: boolean;
	/** The card outcome, shown on the Primary Die in the die picker. */
	primaryOutcome: DieOutcome;
	primaryDieBonuses: readonly PrimaryDieBonusLine[];
	text: IncomingReactionText;
}
