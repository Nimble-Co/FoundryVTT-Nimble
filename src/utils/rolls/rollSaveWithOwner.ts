import { SYSTEM_ID } from '#system';

const QUERY_NAME = `${SYSTEM_ID}.rollSave`;
const QUERY_TIMEOUT_MS = 5 * 60 * 1000;

interface SaveOptions {
	dc?: number | null;
	cardFlags?: Record<string, unknown>;
}

interface SavingActor {
	uuid: string;
	testUserPermission(user: unknown, level: number): boolean;
	rollSavingThrowToChat(key: string, options: SaveOptions): Promise<unknown>;
}

interface QueryUser {
	active: boolean;
	isGM: boolean;
	query(name: string, data: object, options: { timeout: number }): Promise<unknown>;
}

async function rollHere(actor: SavingActor, saveKey: string, options: SaveOptions) {
	return !!(await actor.rollSavingThrowToChat(saveKey, options));
}

/**
 * The creature makes a save with the roll window: the player who owns it rolls
 * on their own client, or this client when no such player is online. False
 * when no card was posted.
 */
export async function rollSaveWithOwner(
	actor: SavingActor,
	saveKey: string,
	options: SaveOptions,
): Promise<boolean> {
	const owner = (Array.from(game.users ?? []) as unknown as QueryUser[]).find(
		(user) =>
			user.active &&
			!user.isGM &&
			actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
	);
	if (!owner || (owner as unknown) === game.user) return rollHere(actor, saveKey, options);
	const made = await owner.query(
		QUERY_NAME,
		{ actorUuid: actor.uuid, saveKey, options },
		{ timeout: QUERY_TIMEOUT_MS },
	);
	return made === true;
}

export function registerRollSaveQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			actorUuid: string;
			saveKey: string;
			options: SaveOptions;
		}) => {
			const actor = fromUuidSync(data.actorUuid as never) as unknown as SavingActor | null;
			return actor ? rollHere(actor, data.saveKey, data.options) : false;
		};
	});
}
