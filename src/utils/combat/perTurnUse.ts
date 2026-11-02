import { SYSTEM_ID } from '#system';

const FLAG = 'turnUses';

interface FlagActor {
	getFlag?(scope: string, key: string): unknown;
	update?(data: Record<string, unknown>): Promise<unknown>;
}

/** This turn of the started combat, of any creature. Null outside combat. */
function currentTurnId(): string | null {
	const combat = game.combat;
	if (!combat?.started) return null;
	return `${combat.id}:${combat.round}:${combat.turn}`;
}

function usesOf(actor: FlagActor): Record<string, string> {
	return (actor.getFlag?.(SYSTEM_ID, FLAG) as Record<string, string> | undefined) ?? {};
}

const flagKey = (key: string) => key.replaceAll('.', '_');

/** Whether a 1/turn use with this key was spent this turn. Outside combat there is no limit. */
export function usedThisTurn(actor: Actor | null | undefined, key: string): boolean {
	const turn = currentTurnId();
	if (!actor || !turn) return false;
	return usesOf(actor as unknown as FlagActor)[flagKey(key)] === turn;
}

/** Spend a 1/turn use. */
export async function markTurnUse(actor: Actor | null | undefined, key: string): Promise<void> {
	const turn = currentTurnId();
	if (!actor || !turn) return;
	await actor.update({ [`flags.${SYSTEM_ID}.${FLAG}.${flagKey(key)}`]: turn } as never);
}

/** Give back a 1/turn use, when it was spent this turn. */
export async function clearTurnUse(actor: Actor | null | undefined, key: string): Promise<void> {
	if (!usedThisTurn(actor, key)) return;
	await actor?.update({ [`flags.${SYSTEM_ID}.${FLAG}.-=${flagKey(key)}`]: null } as never);
}
