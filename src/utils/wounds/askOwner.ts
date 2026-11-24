import { SYSTEM_ID } from '#system';
import localize from '../localize.js';

const QUERY_NAME = `${SYSTEM_ID}.askOwner`;
const QUERY_TIMEOUT_MS = 5 * 60 * 1000;

/** A yes or no question about a Wound or a drop to 0 HP. `kind` picks the `NIMBLE.wounds.<kind>` words. */
export interface OwnerQuestion {
	kind: 'pending' | 'drop' | 'move';
	name: string;
	count?: number;
}

interface OwnedCreature {
	uuid?: string | null;
	testUserPermission?(user: unknown, level: number): boolean;
}

interface QueryUser {
	active: boolean;
	isGM: boolean;
	query(name: string, data: object, options: { timeout: number }): Promise<unknown>;
}

function escapeName(name: string): string {
	const escapeHtml = foundry.utils?.escapeHTML;
	return typeof escapeHtml === 'function' ? escapeHtml(name) : name;
}

async function askHere(question: OwnerQuestion): Promise<boolean> {
	try {
		const confirm = foundry.applications?.api?.DialogV2?.confirm;
		if (!confirm) return false;
		const words = `NIMBLE.wounds.${question.kind}`;
		const yes = await confirm({
			window: { title: localize(`${words}.chooseTitle`) },
			content: `<p>${localize(`${words}.offer`, {
				name: escapeName(question.name),
				count: String(question.count ?? 1),
			})}</p>`,
			yes: { label: localize(`${words}.use`) },
			no: { label: localize(`${words}.skip`) },
			rejectClose: false,
		});
		return yes === true;
	} catch {
		return false;
	}
}

function onlineOwner(actor: OwnedCreature): QueryUser | null {
	const level = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
	const owns = (user: QueryUser) =>
		user.active && !user.isGM && !!actor.testUserPermission?.(user, level);
	const self = game.user as unknown as QueryUser | null;
	if (self && owns(self)) return self;
	const users = Array.from(game.users ?? []) as unknown as QueryUser[];
	return users.find(owns) ?? null;
}

/**
 * Asks the player who owns the creature, on their own client. This client asks
 * when this user owns it, or when no player who owns it is online. A closed dialog, or no answer
 * in time, is a no.
 */
export async function askOwner(actor: object, question: OwnerQuestion): Promise<boolean> {
	const owner = onlineOwner(actor as OwnedCreature);
	if (!owner || (owner as unknown) === game.user) return askHere(question);
	try {
		const answer = await owner.query(QUERY_NAME, { question }, { timeout: QUERY_TIMEOUT_MS });
		return answer === true;
	} catch {
		return false;
	}
}

export function registerAskOwnerQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { question: OwnerQuestion }) => askHere(data.question);
	});
}
