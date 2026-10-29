import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroBioTabView } from '#view/actorSheets/hero/heroBioTab.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroBioTabProps {
	view: HeroBioTabView;
	ui: SheetUiState;
	perform: HeroPerform;
}
