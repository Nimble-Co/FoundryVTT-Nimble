export type CombatActorFixtureOptions = {
	id?: string;
	hp?: number;
	woundsValue?: number;
	woundsMax?: number;
};

export type CombatantFixtureOptions = {
	id?: string;
	type?: string;
	sort?: number;
	isOwner?: boolean;
	initiative?: number | null;
	defeated?: boolean;
	actor?: Actor.Implementation | null;
	combatId?: string;
	actorId?: string;
	sceneId?: string;
	actionsCurrent?: number;
	actionsMax?: number;
};

type CombatantsCollectionFixture = Combatant.Implementation[] & {
	contents: Combatant.Implementation[];
	get: (id: string) => Combatant.Implementation | null;
};

export function createCombatActorFixture({
	id = 'actor-1',
	hp = 10,
	woundsValue,
	woundsMax,
}: CombatActorFixtureOptions = {}): Actor.Implementation {
	return {
		id,
		system: {
			attributes: {
				hp: { value: hp },
				wounds: { value: woundsValue, max: woundsMax },
			},
		},
	} as unknown as Actor.Implementation;
}

export function createCombatantFixture({
	id = 'combatant-1',
	type = 'npc',
	sort = 0,
	isOwner = false,
	initiative = null,
	defeated = false,
	actor = null,
	combatId = 'combat-1',
	actorId = '',
	sceneId = 'scene-1',
	actionsCurrent = 1,
	actionsMax = 2,
}: CombatantFixtureOptions = {}): Combatant.Implementation {
	const resolvedActorId = actorId || actor?.id || '';

	return {
		id,
		_id: id,
		type,
		isOwner,
		defeated,
		initiative,
		actor,
		actorId: resolvedActorId,
		parent: { id: combatId },
		sceneId,
		system: {
			sort,
			actions: {
				base: {
					current: actionsCurrent,
					max: actionsMax,
				},
			},
		},
	} as unknown as Combatant.Implementation;
}

export function createCombatantsCollectionFixture(
	combatants: Combatant.Implementation[],
): CombatantsCollectionFixture {
	const collection = combatants as CombatantsCollectionFixture;
	collection.contents = combatants;
	collection.get = (id: string) => combatants.find((combatant) => combatant.id === id) ?? null;
	return collection;
}
