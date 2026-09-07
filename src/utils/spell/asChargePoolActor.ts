import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import type { CharacterActorLike } from '../chargePool/types.js';

/**
 * The charge pool helpers take a full character document. `SpellCostActorLike`
 * names only the slice the cost functions read themselves; the helpers also
 * read the pool flags and item rules off the same document. The cast that
 * bridges the two is confined here.
 */
export function asChargePoolActor(actor: SpellCostActorLike): CharacterActorLike {
	return actor as unknown as CharacterActorLike;
}
