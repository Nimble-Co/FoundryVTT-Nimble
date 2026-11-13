import type { NimbleChatMessage } from '#documents/chatMessage.ts';

export interface CardEventsProps {
	messageDocument: NimbleChatMessage;
	/** Show the "Events" label. A moment card has its own heading. */
	labelled?: boolean;
}
