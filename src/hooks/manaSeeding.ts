import { SYSTEM_ID } from '#system';

const PREVIOUS_MANA_MAX_PATH = `${SYSTEM_ID}.previousManaMax`;

type ManaSnapshot = {
	actor: Actor.Implementation;
	actorUuid: string;
	current: number;
	max: number;
};

function getManaSnapshot(actor: unknown): ManaSnapshot | null {
	if (!actor || typeof actor !== 'object') return null;
	const typedActor = actor as Actor.Implementation;
	if (typedActor.type !== 'character') return null;

	const mana = (
		typedActor.system as { resources?: { mana?: { current?: unknown; max?: unknown } } }
	)?.resources?.mana;
	if (!mana) return null;

	const current = Number(mana.current ?? 0);
	const max = Number(mana.max ?? 0);
	if (!Number.isFinite(current) || !Number.isFinite(max)) return null;

	// Keyed by uuid rather than id: an unlinked token's synthetic actor carries
	// the base actor's id, so several of them in one batch would share a key.
	const actorUuid = typedActor.uuid;
	if (!actorUuid) return null;

	return { actor: typedActor, actorUuid, current, max };
}

function readStash(options: object): Record<string, number> | undefined {
	return foundry.utils.getProperty(options, PREVIOUS_MANA_MAX_PATH) as
		| Record<string, number>
		| undefined;
}

// Derived max mana is still the pre-update value inside pre-hooks, so it is
// recorded on the update options for the post-hook to compare against.
//
// Keyed per actor because one options object is shared by every document in a
// batched update: the backend runs the whole pre-hook loop before any
// post-hook, so a single slot would leave every actor reading the last one's
// value.
function stashPreviousManaMax(actor: unknown, options: unknown): void {
	const snapshot = getManaSnapshot(actor);
	if (!snapshot || !options || typeof options !== 'object') return;

	// Indexed into a record rather than appended to the path: a uuid contains
	// dots, which `setProperty` would read as nesting.
	const stash = readStash(options) ?? {};
	stash[snapshot.actorUuid] = snapshot.max;
	foundry.utils.setProperty(options, PREVIOUS_MANA_MAX_PATH, stash);
}

async function seedManaIfNewlyAvailable(
	actor: unknown,
	options: unknown,
	userId: unknown,
): Promise<void> {
	// Only the client that initiated the change writes. That client has
	// permission by construction, and every other connected client skips the
	// write instead of attempting one the server would reject.
	if (!userId || game.user?.id !== userId) return;

	const snapshot = getManaSnapshot(actor);
	if (!snapshot || !options || typeof options !== 'object') return;

	const previousMax = readStash(options)?.[snapshot.actorUuid];
	if (typeof previousMax !== 'number') return;

	if (previousMax > 0) return;

	// Seed only on the transition from "no pool" to "has a pool", and never
	// touch a value that already exists.
	if (snapshot.max <= 0 || snapshot.current !== 0) return;

	await snapshot.actor.update({
		'system.resources.mana.current': snapshot.max,
	} as Parameters<Actor.Implementation['update']>[0]);
}

export default function registerManaSeedingHooks(): void {
	Hooks.on('preUpdateActor', (actor: Actor.Implementation, _changes, options) => {
		stashPreviousManaMax(actor, options);
	});

	Hooks.on('updateActor', (actor: Actor.Implementation, _changes, options, userId) => {
		void seedManaIfNewlyAvailable(actor, options, userId);
	});
}
