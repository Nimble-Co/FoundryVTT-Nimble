import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroSource } from '#view/actorSheets/hero/heroSource.ts';
import type { SheetUiState } from '#view/actorSheets/shared/sheetUiState.ts';

export interface HeroSheetProps {
	source: () => HeroSource;
	ui: SheetUiState;
	perform: HeroPerform;
}
