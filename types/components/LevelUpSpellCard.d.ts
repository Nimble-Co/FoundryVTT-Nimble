import type { SpellIndexEntry } from '#utils/getSpells.js';
import type { SpellEffect } from './SpellReferenceCard.d.ts';

export interface LevelUpSpellCardProps {
	spell: SpellIndexEntry;
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
	manaCost: number;
	effect: SpellEffect | null;
	baseEffect: string | null;
	higherLevelEffect: string | null;
}
