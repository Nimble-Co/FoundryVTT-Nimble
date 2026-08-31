// `NimbleAncestryItem`, `NimbleAncestryBonusItem` and `NimbleClassItem` are global ambient types
// (src/documents/item/item.d.ts).

/** Props for the ancestry-options character-creation step. */
export interface AncestryOptionsSelectionProps {
	active: boolean;
	selectedAncestry: NimbleAncestryItem | null;
	/** The bonus whose `requiresChoice` rules decide whether a save is asked for. */
	selectedAncestryBonus: NimbleAncestryBonusItem | null;
	/** Supplies the saves the class is already good at, which are dropped from the offer. */
	selectedClass: NimbleClassItem | null;
	/** The kind of people the character is, for an ancestry covering more than one (two-way bound). */
	selectedAncestryVariant: string | null;
	selectedAncestrySize: string | null;
	selectedAncestrySave: string | null;
}

/** A row in a pick-exactly-one list. Sizes carry a description, variants carry an icon. */
export interface AncestryChoiceOption {
	value: string;
	label: string;
	description: string;
	icon: string;
}

/** A step the player may be asked, and the localized header it takes when they are. */
export type AncestryStepKey = 'variant' | 'sizeCategory' | 'enhancedSave';

/** One candidate step: whether it is asked, its key, and its unlettered label. */
export type AncestryStepCandidate = [asked: boolean, key: AncestryStepKey, label: string];
