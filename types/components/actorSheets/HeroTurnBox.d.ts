import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroTurnView } from '#view/actorSheets/hero/heroRail.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroTurnBoxProps {
	turn: HeroTurnView;
	ui: SheetUiState;
	perform: HeroPerform;
	compact?: boolean;
}
