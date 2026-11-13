/** Actor subtypes that share the monster sheet and can be converted between each other. */
export const MONSTER_ACTOR_TYPES = ['npc', 'minion', 'soloMonster'] as const;
export type MonsterActorType = (typeof MONSTER_ACTOR_TYPES)[number];

export function isMonsterActorType(type: string | null | undefined): type is MonsterActorType {
	return (MONSTER_ACTOR_TYPES as readonly string[]).includes(type ?? '');
}
