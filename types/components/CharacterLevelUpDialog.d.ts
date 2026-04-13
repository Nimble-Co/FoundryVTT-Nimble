import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ExpandableDocumentItem } from './ExpandableDocumentList.d.ts';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export type { SubclassChoice, EpicBoonChoice } from './LevelUpChoices.d.ts';

export interface CharacterLevelUpDialogProps {
	document: NimbleCharacter;
	dialog: GenericDialog;
}

export interface LevelUpSubmitData {
	selectedAbilityScore: string[] | string | null;
	selectedSubclass: ExpandableDocumentItem | null;
	selectedEpicBoon: ExpandableDocumentItem | null;
	skillPointChanges: Record<string, number | null>;
	takeAverageHp: boolean;
	classFeatures: {
		autoGrant: NimbleFeatureItem[];
		selected: Map<string, NimbleFeatureItem>;
	} | null;
	spellUuids: string[];
}
