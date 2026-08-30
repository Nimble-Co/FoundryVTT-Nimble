import type { Snippet } from 'svelte';

import type { SpellIndexEntry } from '#utils/getSpells.js';

/**
 * `chooser` asks where a dropped spell should go; `picker` asks which spell a
 * dropped scroll blank carries.
 */
export type SpellScrollDialogMode = 'chooser' | 'picker';

export type SpellScrollDestination = 'spellList' | 'scroll';

/** The answer the dialog resolves with. */
export interface SpellScrollDialogResult {
	destination: SpellScrollDestination;
	/** Picker mode only. Chooser mode inscribes the spell that was dropped. */
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
	actorName: string;
	/** Chooser mode: the dropped spell's tier, which is also its mana cost. */
	tier?: number;
	/** Chooser mode. */
	school?: string;
	/** Chooser mode. */
	activationSummary?: string;
	/** In gp, derived from the tier. */
	scrollPrice?: number;
	/** 0 when the actor has no spellcasting. */
	highestUnlockedSpellTier?: number;
	isSpellcaster?: boolean;
	knowsSchool?: boolean;
	/** Picker mode: the spells of the blank's tier that may be inscribed. */
	candidates?: SpellScrollCandidate[];
	/**
	 * Picker mode: fetches one candidate's enriched description when its row is
	 * expanded. Injected rather than imported, because importing it would put a
	 * cycle between the dialog and the module that opens it.
	 */
	loadDescription?: (uuid: string) => Promise<string>;
	/** Localized, e.g. "Tier 3" or "Cantrip". */
	tierLabel?: string;
}

/** Props for the card that renders one destination choice in the chooser. */
export interface SpellScrollChoiceCardProps {
	/** Radio group name, scoped to the owning dialog instance. */
	name: string;
	value: SpellScrollDestination;
	/** Bound, so clicking the card selects it. */
	group: SpellScrollDestination;
	/** Font Awesome class. */
	icon: string;
	title: string;
	hint: string;
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
