import localize from './localize.js';

interface QueryUser {
	query(name: string, data: object): Promise<unknown>;
}

/** Runs a query on the active GM's client, or warns when no GM is online. */
export async function askActiveGm(queryName: string, data: object): Promise<void> {
	const gm = (game.users as unknown as { activeGM?: QueryUser | null }).activeGM;
	if (!gm) {
		ui.notifications?.warn(localize('NIMBLE.chat.cardActionNeedsGm'));
		return;
	}
	await gm.query(queryName, data);
}
