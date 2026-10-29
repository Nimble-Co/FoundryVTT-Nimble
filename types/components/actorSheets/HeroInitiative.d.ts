import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroRailView } from '#view/actorSheets/hero/heroRail.ts';

export interface HeroInitiativeProps {
	initiative: HeroRailView['initiative'];
	editing: boolean;
	perform: HeroPerform;
}
