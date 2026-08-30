import type { SpellIndexEntry } from '#utils/getSpells.js';
import type { SpellCostActorLike } from '#types/spellCost.d.ts';
import type { SpellEffect } from './SpellReferenceCard.d.ts';

export interface LevelUpSpellCardProps {
	spell: SpellIndexEntry;
	/** Resolves the cast's cost, which depends on the character's class. */
	actor: SpellCostActorLike;
}

/**
 * Display data extracted from a spell's full system data.
 * Populated asynchronously after loading the spell via fromUuid.
 */
export interface SpellDisplayData {
	meta: string | null;
	requiresConcentration: boolean;
	targetType: string | null;
	spellRange: string | null;
	/** The cast's cost as shown, or null when the cast is free. */
	costLabel: string | null;
	effect: SpellEffect | null;
	baseEffect: string | null;
	higherLevelEffect: string | null;
}
