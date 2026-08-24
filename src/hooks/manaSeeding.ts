import { SYSTEM_ID } from '#system';

const PREVIOUS_MANA_MAX_PATH = `${SYSTEM_ID}.previousManaMax`;

type ManaSnapshot = {
	actor: Actor.Implementation;
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

	return { actor: typedActor, current, max };
}

function toClassItemActor(item: unknown): Actor.Implementation | null {
	if (!item || typeof item !== 'object') return null;
	const typedItem = item as Item.Implementation;
	if (typedItem.type !== 'class') return null;
	return typedItem.actor ?? null;
}

// Derived max mana is still the pre-update value inside pre-hooks, so it is
// recorded on the update options for the post-hook to compare against.
function stashPreviousManaMax(actor: unknown, options: unknown): void {
	const snapshot = getManaSnapshot(actor);
	if (!snapshot || !options || typeof options !== 'object') return;
	foundry.utils.setProperty(options, PREVIOUS_MANA_MAX_PATH, snapshot.max);
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

	const previousMax = foundry.utils.getProperty(options, PREVIOUS_MANA_MAX_PATH);
	if (typeof previousMax !== 'number' || previousMax > 0) return;

	// Seed only on the transition from "no pool" to "has a pool", and never
	// touch a value that already exists.
	if (snapshot.max <= 0 || snapshot.current !== 0) return;

	await snapshot.actor.update({
		'system.resources.mana.current': snapshot.max,
	} as Parameters<Actor.Implementation['update']>[0]);
}

export default function registerManaSeedingHooks(): void {
	Hooks.on('preCreateItem', (item: Item.Implementation, _data, options) => {
		stashPreviousManaMax(toClassItemActor(item), options);
	});

	Hooks.on('createItem', (item: Item.Implementation, options, userId) => {
		void seedManaIfNewlyAvailable(toClassItemActor(item), options, userId);
	});

	Hooks.on('preUpdateItem', (item: Item.Implementation, _changes, options) => {
		stashPreviousManaMax(toClassItemActor(item), options);
	});

	Hooks.on('updateItem', (item: Item.Implementation, _changes, options, userId) => {
		void seedManaIfNewlyAvailable(toClassItemActor(item), options, userId);
	});

	Hooks.on('preUpdateActor', (actor: Actor.Implementation, _changes, options) => {
		stashPreviousManaMax(actor, options);
	});

	Hooks.on('updateActor', (actor: Actor.Implementation, _changes, options, userId) => {
		void seedManaIfNewlyAvailable(actor, options, userId);
	});
}
