import type { CardSurge } from '#types/surgeMana.d.ts';

export interface SurgeCardMessage {
	isAuthor?: boolean;
	reactive?: { system?: { surge?: CardSurge | null; actorUuid?: string | null } };
	system: { surge?: CardSurge | null };
	update(changes: Record<string, unknown>): Promise<unknown>;
	speakerActor?: unknown;
}

export interface SurgeLineProps {
	messageDocument: SurgeCardMessage;
}
