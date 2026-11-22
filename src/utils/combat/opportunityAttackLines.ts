import { getActiveCombatForCurrentScene } from './combatState.js';
import { collectAllyOpportunityOffers, type GrantedActionOffer } from './grantedActionOffers.js';

type CombatToken = Parameters<typeof collectAllyOpportunityOffers>[1] extends Iterable<infer T>
	? T
	: never;

/**
 * The lines the attacker's allies in the combat get on the card of the attacker's
 * opportunity attack.
 */
export function opportunityAttackLines(
	attacker: { id?: string | null; uuid?: string | null } | null | undefined,
): GrantedActionOffer[] {
	const combat = getActiveCombatForCurrentScene();
	if (!combat || !attacker) return [];
	const tokens = [...combat.combatants]
		.map((combatant) => (combatant as { token?: CombatToken | null }).token ?? null)
		.filter((token): token is CombatToken => !!token);
	const attackerToken = tokens.find(
		(token) =>
			(token.actor as { uuid?: string } | null)?.uuid === attacker.uuid ||
			(token.actor as { id?: string } | null)?.id === attacker.id,
	);
	return collectAllyOpportunityOffers(attackerToken, tokens);
}
