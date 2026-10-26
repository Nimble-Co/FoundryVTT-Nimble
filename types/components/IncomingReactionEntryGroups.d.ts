import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionText,
} from './IncomingReactionPrompts.d.ts';

export interface IncomingReactionEntryGroupsProps {
	groups: IncomingReactionActorGroup[];
	busy: boolean;
	text: IncomingReactionText;
	onuse: (entry: IncomingReactionEntry) => void;
}
