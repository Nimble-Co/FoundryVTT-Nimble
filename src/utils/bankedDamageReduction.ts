import { SYSTEM_ID } from '#system';

const BANKED_DAMAGE_REDUCTION_PATH = `flags.${SYSTEM_ID}.bankedDamageReduction`;

/**
 * One-shot incoming-damage reduction banked on an actor by a manual dice-pool
 * spend (a `diceConsumer` rule with `effectType: 'damageReduction'`, e.g.
 * Berserker's "That all you got?!"). Stored as a document flag so the spend
 * made on the player's client is visible to the GM's damage application.
 * Consumed and cleared by the next damage applied to the actor.
 */
function getBankedDamageReduction(actor: Actor.Implementation): number {
	const value = Number(foundry.utils.getProperty(actor, BANKED_DAMAGE_REDUCTION_PATH));
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.floor(value);
}

async function addBankedDamageReduction(
	actor: Actor.Implementation,
	amount: number,
): Promise<void> {
	const addition = Math.floor(Number(amount));
	if (!Number.isFinite(addition) || addition <= 0) return;

	await actor.update({
		[BANKED_DAMAGE_REDUCTION_PATH]: getBankedDamageReduction(actor) + addition,
	} as Actor.UpdateData);
}

async function clearBankedDamageReduction(actor: Actor.Implementation): Promise<void> {
	if (getBankedDamageReduction(actor) === 0) return;
	await actor.update({ [BANKED_DAMAGE_REDUCTION_PATH]: 0 } as Actor.UpdateData);
}

export { addBankedDamageReduction, clearBankedDamageReduction, getBankedDamageReduction };
