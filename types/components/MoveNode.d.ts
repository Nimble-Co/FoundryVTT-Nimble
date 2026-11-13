import type { MoveTextCard } from '#view/chat/components/moveNodeText.ts';
import type { MoveNode } from '../effectTree.js';

export interface MoveNodeProps {
	node: MoveNode;
	/** The card of the move. Unset: the card in the `messageDocument` context. */
	card?: MoveTextCard;
	/** List every creature here, also one the Targets section shows. An Events line does. */
	allRows?: boolean;
}
