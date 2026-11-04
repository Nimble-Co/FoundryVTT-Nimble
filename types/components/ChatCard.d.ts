import type { NimbleChatMessage } from '#documents/chatMessage.ts';

/** What the renderer gives a chat card component. */
export interface ChatCardProps {
	messageDocument: NimbleChatMessage;
}
