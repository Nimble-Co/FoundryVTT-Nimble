import type { NimbleChatMessage } from '../../src/documents/chatMessage';

export interface CheckCardRollsProps {
	messageDocument: NimbleChatMessage;
	/** The check's name, such as "Strength Save" */
	label: string;
}
