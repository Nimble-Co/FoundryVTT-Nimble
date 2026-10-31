import type { MonsterPerform } from '#view/actorSheets/monster/monsterIntent.ts';
import type { MonsterSettingsTabView } from '#view/actorSheets/monster/monsterSettingsTab.ts';

export interface MonsterSettingsTabProps {
	view: MonsterSettingsTabView;
	perform: MonsterPerform;
}
