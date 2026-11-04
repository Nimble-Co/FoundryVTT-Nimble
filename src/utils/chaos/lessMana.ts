import { resolveSpellCost } from '../spell/spellCost.js';
import { canInvokeChaos } from './invokeChaos.js';

/** The tick for 1 less mana: this hero can invoke Chaos, and the spell costs mana. */
export function offersLessManaFor(
	actor: Parameters<typeof resolveSpellCost>[0] | null | undefined,
	spell: Parameters<typeof resolveSpellCost>[1],
): boolean {
	if (!actor || !canInvokeChaos(actor as never)) return false;
	const cost = resolveSpellCost(actor, spell);
	return cost.type === 'mana' && cost.amount > 0;
}
