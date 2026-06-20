export type CombatActorFixtureOptions = {
	id?: string;
	type?: string;
	isOwner?: boolean;
	hp?: number;
	hpMax?: number;
	lastStandHp?: number;
	woundsValue?: number;
	woundsMax?: number;
	manaValue?: number;
	manaMax?: number;
	dyingActionLimit?: number;
};

export type CombatantFixtureOptions = {
	id?: string;
	type?: string;
	sort?: number;
	isOwner?: boolean;
	initiative?: number | null;
	flags?: Record<string, unknown>;
	defeated?: boolean;
	actor?: Actor.Implementation | null;
	combatId?: string;
	actorId?: string;
	sceneId?: string;
	tokenId?: string;
	actionsCurrent?: number;
	actionsMax?: number;
};

type CombatantsCollectionFixture = Combatant.Implementation[] & {
	contents: Combatant.Implementation[];
	get: (id: string) => Combatant.Implementation | null;
};

export function createCombatActorFixture({
	id = 'actor-1',
	type = 'npc',
	isOwner = false,
	hp = 10,
	hpMax,
	lastStandHp,
	woundsValue,
	woundsMax,
	manaValue,
	manaMax,
	dyingActionLimit,
}: CombatActorFixtureOptions = {}): Actor.Implementation {
	const items =
		typeof lastStandHp === 'number'
			? [
					{
						type: 'monsterFeature',
						system: { subtype: 'lastStand', lastStandHp, description: '' },
					},
				]
			: [];

	return {
		id,
		type,
		isOwner,
		items,
		system: {
			attributes: {
				hp: {
					value: hp,
					max: hpMax ?? Math.max(hp, 1),
				},
				wounds: { value: woundsValue, max: woundsMax },
				...(typeof dyingActionLimit === 'number' ? { dyingActionLimit } : {}),
			},
			resources: {
				mana: {
					current: manaValue,
					max: manaMax,
				},
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
	flags = {},
	defeated = false,
	actor = null,
	combatId = 'combat-1',
	actorId = '',
	sceneId = 'scene-1',
	tokenId = '',
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
		flags,
		actor,
		actorId: resolvedActorId,
		tokenId,
		parent: { id: combatId },
		sceneId,
		system: {
			sort,
			actions: {
				base: {
					current: actionsCurrent,
					max: actionsMax,
				},
				heroic: {
					defendAvailable: true,
					interposeAvailable: true,
					opportunityAttackAvailable: true,
					helpAvailable: true,
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
