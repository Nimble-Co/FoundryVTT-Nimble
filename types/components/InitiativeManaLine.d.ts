import type { CardInitiativeMana } from '#types/initiativeManaRoll.d.ts';

export interface SurgeCardMessage {
	isAuthor?: boolean;
	reactive?: { system?: { initiativeMana?: CardInitiativeMana | null; actorUuid?: string | null } };
	system: { initiativeMana?: CardInitiativeMana | null };
	update(changes: Record<string, unknown>): Promise<unknown>;
	speakerActor?: unknown;
}

export interface InitiativeManaLineProps {
	messageDocument: SurgeCardMessage;
}
