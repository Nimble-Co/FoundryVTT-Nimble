import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroRailProps {
	view: HeroRailView;
	ui: SheetUiState;
	perform: HeroPerform;
}
