import type { SpellIndexEntry } from '../../src/utils/getSpells.js';

/** What the dialog was opened to ask. */
export type SpellScrollDialogMode = 'chooser' | 'picker';

/** The answer the dialog resolves with. */
export interface SpellScrollDialogResult extends Record<string, unknown> {
	/** `spellList` adds the spell as a spell; `scroll` inscribes it onto a scroll. */
	destination: 'spellList' | 'scroll';
	/**
	 * Picker mode only: UUID of the spell chosen to inscribe. Absent in chooser
	 * mode, where the spell is the one that was dropped.
	 */
	spellUuid?: string;
}

/** A spell offered in picker mode. */
export interface SpellScrollCandidate extends SpellIndexEntry {
	/** Localized action-cost summary, e.g. "2 Actions". */
	activationSummary: string;
	/** Enriched description shown when the row is expanded. */
	description: string;
}

export interface SpellScrollDialogProps {
	dialog: {
		close: () => Promise<unknown> | unknown;
		submit: (result?: Record<string, unknown>) => Promise<void>;
	};
	mode: SpellScrollDialogMode;
	/** Name of the actor receiving the spell or scroll. */
	actorName: string;
	/** Chooser mode: the dropped spell's tier, which is also its mana cost. */
	tier?: number;
	/** Chooser mode: the dropped spell's school id. */
	school?: string;
	/** Chooser mode: localized action-cost summary of the dropped spell. */
	activationSummary?: string;
	/** Scroll price in gp, derived from the tier. */
	scrollPrice?: number;
	/**
	 * Highest spell tier the actor has unlocked, or 0 when the actor has no
	 * spellcasting. Drives the upcast line and the no-mana warning.
	 */
	highestUnlockedSpellTier?: number;
	/** Whether the actor has any mana at all. */
	hasMana?: boolean;
	/** Whether the actor already knows a spell of the relevant school. */
	knowsSchool?: boolean;
	/** How many spells a batch drop covers. Chooser mode only, omit for a single spell. */
	batchCount?: number;
	/** Picker mode: the spells of the template's tier that may be inscribed. */
	candidates?: SpellScrollCandidate[];
	/** Picker mode: the scroll template's name, used in the title. */
	scrollName?: string;
	/** Picker mode: localized label for the template's tier, e.g. "Tier 3". */
	tierLabel?: string;
}
