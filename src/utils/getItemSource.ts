/** UUID prefix Foundry gives to documents that live inside a compendium pack. */
const COMPENDIUM_UUID_PREFIX = 'Compendium.';

/** Where a document lives: `'world'` for a locally created or customized copy, `'compendium'` for a packaged one. */
export type ItemSource = 'world' | 'compendium';

/**
 * Reports whether a document lives in a compendium pack or in the world, based on its UUID.
 * World UUIDs look like `Item.abc123`; pack UUIDs look like
 * `Compendium.<scope>.<pack>.Item.abc123`.
 */
export default function getItemSource(uuid: string): ItemSource {
	return uuid.startsWith(COMPENDIUM_UUID_PREFIX) ? 'compendium' : 'world';
}
