import type { Snippet } from 'svelte';

import type { SpellIndexEntry } from '#utils/getSpells.js';

/** What the dialog was opened to ask. */
export type SpellScrollDialogMode = 'chooser' | 'picker';

/** Where the dropped spell is headed. */
export type SpellScrollDestination = 'spellList' | 'scroll';

/** The answer the dialog resolves with. */
export interface SpellScrollDialogResult {
	/** `spellList` adds the spell as a spell; `scroll` inscribes it onto a scroll. */
	destination: SpellScrollDestination;
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
}

/** A school filter tab, in the shape `SecondaryNavigation` expects. */
export interface SpellScrollNavigationTab {
	/** Font Awesome class for a built-in school, or an image path for a custom one. */
	icon: string;
	/** School id, or `all` for the unfiltered tab. */
	name: string;
	/** Localization key for the tooltip and accessible label. */
	tooltip: string;
}

export interface SpellScrollDialogInstance {
	submit: (result?: SpellScrollDialogResult) => Promise<void>;
}

export interface SpellScrollDialogProps {
	dialog: SpellScrollDialogInstance;
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
	/** Picker mode: the spells of the template's tier that may be inscribed. */
	candidates?: SpellScrollCandidate[];
	/**
	 * Picker mode: fetches one candidate's enriched description, called when its
	 * row is expanded. Injected rather than imported so the dialog does not reach
	 * back into the module that opens it, and so tests can supply their own.
	 */
	loadDescription?: (uuid: string) => Promise<string>;
	/** Localized label for the tier in play, e.g. "Tier 3" or "Cantrip". */
	tierLabel?: string;
}

/** Props for the card that renders one destination choice in the chooser. */
export interface SpellScrollChoiceCardProps {
	/** Radio group name, scoped to the owning dialog instance. */
	name: string;
	/** This card's value within the group. */
	value: SpellScrollDestination;
	/** The group's current value; bound so clicking the card selects it. */
	group: SpellScrollDestination;
	/** Font Awesome class shown beside the title. */
	icon: string;
	title: string;
	/** One-line summary under the title. */
	hint: string;
	/** The fact list, warning, or anything else the card carries. */
	children?: Snippet;
}

/** Props for one selectable spell row in the picker. */
export interface SpellScrollCandidateRowProps {
	candidate: SpellScrollCandidate;
	/** Localized school name, used for the icon's accessible label. */
	schoolLabel: string;
	isSelected: boolean;
	isExpanded: boolean;
	/** Enriched description, or null while the expanded row is still fetching it. */
	description: string | null;
	onSelect: () => void;
	onToggleDetails: () => void;
}
