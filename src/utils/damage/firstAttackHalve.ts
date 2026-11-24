import { SYSTEM_ID } from '#system';

/** Actor flag: the attack card that already used the halve. */
export const FIRST_ATTACK_HALVE_FLAG = 'firstAttackHalved';

/** Ephemeral system flag set by the rule during data prep. */
export const HALVE_FIRST_ATTACK_PATH = 'halveFirstAttack';

export interface FirstAttackHalveStamp {
	combatId: string;
	messageId: string;
}

interface FlagActor {
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

/**
 * Whether this card is the first attack against the creature since its stamp
 * was cleared. A missing stamp, or one from another combat, is a first attack.
 * The card in the stamp still halves. No started combat means no halve.
 */
export function decideFirstAttackHalve(input: {
	stamp: FirstAttackHalveStamp | null;
	combatId: string | null;
	messageId: string | null;
}): boolean {
	if (!input.combatId || !input.messageId) return false;
	const { stamp } = input;
	if (!stamp || stamp.combatId !== input.combatId) return true;
	return stamp.messageId === input.messageId;
}

export function readFirstAttackHalveStamp(
	actor: Pick<FlagActor, 'getFlag'>,
): FirstAttackHalveStamp | null {
	const raw = actor.getFlag(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG);
	if (!raw || typeof raw !== 'object') return null;
	const stamp = raw as Partial<FirstAttackHalveStamp>;
	if (typeof stamp.combatId !== 'string' || typeof stamp.messageId !== 'string') return null;
	return { combatId: stamp.combatId, messageId: stamp.messageId };
}

/** The id of the started combat this halve belongs to, or nothing. */
export function currentFirstAttackCombatId(): string | null {
	const combat = game.combat;
	return combat?.started && combat.id ? combat.id : null;
}

/** Record the card that used the halve. */
export async function rememberFirstAttackHalve(
	actor: FlagActor,
	messageId: string | null,
): Promise<void> {
	const combatId = currentFirstAttackCombatId();
	if (!combatId || !messageId) return;
	const stamp: FirstAttackHalveStamp = { combatId, messageId };
	await actor.setFlag(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG, stamp);
}
