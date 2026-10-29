import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterRailView } from '#view/actorSheets/monster/monsterRail.ts';

export interface MonsterHitPointsProps {
	view: MonsterRailView;
	perform: MonsterPerform;
	/** the smaller plates of the narrow header */
	compact?: boolean;
}
