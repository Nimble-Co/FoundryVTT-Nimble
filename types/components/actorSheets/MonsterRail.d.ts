import type { MonsterFrameView } from '#view/actorSheets/monster/monsterFrame.ts';
import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterRailView } from '#view/actorSheets/monster/monsterRail.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface MonsterRailProps {
	view: MonsterRailView;
	frame: MonsterFrameView;
	ui: SheetUiState;
	perform: MonsterPerform;
	/** narrow: no portrait, HP or tabs; the header and the tab strip hold them */
	narrow?: boolean;
}
