import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';

export interface HeroHitPointsProps {
	view: HeroRailView;
	editing: boolean;
	perform: HeroPerform;
	compact?: boolean;
}
