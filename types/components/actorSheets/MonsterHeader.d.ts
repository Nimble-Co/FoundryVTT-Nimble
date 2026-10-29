import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterRailView } from '#view/actorSheets/monster/monsterRail.ts';

export interface MonsterHeaderProps {
	view: MonsterRailView;
	perform: MonsterPerform;
	/** Expand all of the Abilities tab; null on the other tabs */
	expandAll: { allOpen: boolean; onclick: () => void } | null;
}
