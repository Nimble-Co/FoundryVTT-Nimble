import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterRailView } from '#view/actorSheets/monster/monsterRail.ts';

export interface MonsterHitPointsProps {
	view: MonsterRailView;
	perform: MonsterPerform;
	/** edit mode: the numbers rest, and you type the max HP */
	editing?: boolean;
	/** the smaller plates of the narrow header */
	compact?: boolean;
}
