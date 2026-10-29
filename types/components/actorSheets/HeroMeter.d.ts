import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroMeterView } from '#view/actorSheets/hero/heroRail.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroMeterProps {
	meter: HeroMeterView;
	ui: SheetUiState;
	perform: HeroPerform;
}
