import type { MonsterAbilityEntry } from '#view/actorSheets/monster/monsterAbilitiesTab.ts';
import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterAbilityEntryProps {
	entry: MonsterAbilityEntry;
	ui: SheetUiState;
	perform: MonsterPerform;
	/** the id prefix for the text of a card */
	uid: string;
}
