import type { MonsterNotesTabView } from '#view/actorSheets/monster/monsterNotesTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterNotesTabProps {
	view: MonsterNotesTabView;
	ui: SheetUiState;
}
