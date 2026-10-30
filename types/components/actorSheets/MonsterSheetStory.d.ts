import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterSource } from '#view/actorSheets/monster/monsterSource.ts';

export interface MonsterSheetStoryProps {
	source: () => MonsterSource;
	perform: MonsterPerform;
	width: number;
	height: number;
	/** the tab at the start; default abilities */
	tab?: string;
	/** start in edit mode */
	editing?: boolean;
	/** theme-light or theme-dark; leave it out to follow the toolbar */
	theme?: string;
}
