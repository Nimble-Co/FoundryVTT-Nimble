import type { NimbleCharacter } from '#documents/actor/character.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ExpandableDocumentItem } from './ExpandableDocumentList.d.ts';
import type GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';

export interface CharacterLevelUpDialogProps {
	document: NimbleCharacter;
	dialog: GenericDialog;
}

export interface SubclassChoice {
	uuid: string;
	name: string;
	img: string;
	system: { parentClass: string };
}

export interface EpicBoonChoice {
	uuid: string;
	name: string;
	img: string;
	system: { boonType: string; description: string };
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
}
