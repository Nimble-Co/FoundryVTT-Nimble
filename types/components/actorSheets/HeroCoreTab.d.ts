import type { HeroCoreView } from '#view/actorSheets/hero/heroCoreTab.ts';
import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';

export interface HeroCoreTabProps {
	view: HeroCoreView;
	editing: boolean;
	perform: HeroPerform;
	/** 2 or 3 columns of skills: the width of the tab decides */
	skillColumns: number;
}
