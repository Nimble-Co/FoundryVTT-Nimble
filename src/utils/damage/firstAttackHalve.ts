import { SYSTEM_ID } from '#system';

/** Actor flag: the attack that already used this round's halve. */
export const FIRST_ATTACK_HALVE_FLAG = 'firstAttackHalved';

/** Ephemeral system flag set by the rule during data prep. */
export const HALVE_FIRST_ATTACK_PATH = 'halveFirstAttack';

export interface FirstAttackHalveStamp {
	combatId: string;
	round: number;
	messageId: string;
}

interface FlagActor {
	getFlag?(scope: string, key: string): unknown;
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
	update?(data: object): Promise<unknown>;
	flags?: object;
}

/**
 * Whether this card is the first attack against the creature in this combat
 * round. A missing stamp, or one from another combat or round, is a first
 * attack. The same card still halves after it is applied. A different card
 * in the same round does not. No started combat means no halve.
 */
export function decideFirstAttackHalve(input: {
	hasRule: boolean;
	stamp: FirstAttackHalveStamp | null;
	combatId: string | null;
	round: number | null;
	messageId: string | null;
}): boolean {
	if (!input.hasRule || !input.combatId || input.round == null || !input.messageId) return false;
	const { stamp } = input;
	if (!stamp || stamp.combatId !== input.combatId || stamp.round !== input.round) return true;
	return stamp.messageId === input.messageId;
}

export function readFirstAttackHalveStamp(actor: FlagActor): FirstAttackHalveStamp | null {
	const raw =
		actor.getFlag?.(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG) ??
		foundry.utils.getProperty(actor, `flags.${SYSTEM_ID}.${FIRST_ATTACK_HALVE_FLAG}`);
	if (!raw || typeof raw !== 'object') return null;
	const stamp = raw as Partial<FirstAttackHalveStamp>;
	if (
		typeof stamp.combatId !== 'string' ||
		typeof stamp.round !== 'number' ||
		typeof stamp.messageId !== 'string'
	) {
		return null;
	}
	return { combatId: stamp.combatId, round: stamp.round, messageId: stamp.messageId };
}

/** The started combat this halve belongs to, or nothing. */
export function currentFirstAttackCombat(): { combatId: string | null; round: number | null } {
	const combat = game.combat;
	if (!combat?.started || !combat.id || typeof combat.round !== 'number') {
		return { combatId: null, round: null };
	}
	return { combatId: combat.id, round: combat.round };
}

/** Record the card that used the halve. Call this only after that damage is applied. */
export async function rememberFirstAttackHalve(
	actor: FlagActor,
	messageId: string | null,
): Promise<void> {
	const combat = currentFirstAttackCombat();
	if (!combat.combatId || combat.round == null || !messageId) return;
	const stamp: FirstAttackHalveStamp = {
		combatId: combat.combatId,
		round: combat.round,
		messageId,
	};
	if (actor.setFlag) {
		await actor.setFlag(SYSTEM_ID, FIRST_ATTACK_HALVE_FLAG, stamp);
		return;
	}
	await actor.update?.({ [`flags.${SYSTEM_ID}.${FIRST_ATTACK_HALVE_FLAG}`]: stamp });
}
