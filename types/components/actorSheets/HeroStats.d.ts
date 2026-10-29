import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';

export interface HeroStatsProps {
	view: HeroRailView;
	editing: boolean;
	perform: HeroPerform;
	/** the rail centers the boxes; the narrow header starts them at the left */
	centered?: boolean;
}
