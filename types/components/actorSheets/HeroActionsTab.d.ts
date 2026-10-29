import type { HeroActionsTabView } from '#view/actorSheets/hero/heroActionsTab.ts';
import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroActionsTabProps {
	view: HeroActionsTabView;
	ui: SheetUiState;
	perform: HeroPerform;
	/** 2 = the reactions in a second column: the width of the tab decides */
	columns: 1 | 2;
}
