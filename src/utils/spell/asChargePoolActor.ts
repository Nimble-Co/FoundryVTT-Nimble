import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import type { CharacterActorLike } from '../chargePool/types.js';

/**
 * The charge pool helpers take a full character document. Everything they
 * touch is present on `SpellCostActorLike`, so the cast is confined here.
 */
export function asChargePoolActor(actor: SpellCostActorLike): CharacterActorLike {
	return actor as unknown as CharacterActorLike;
}
