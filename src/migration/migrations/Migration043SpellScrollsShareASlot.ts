import { MigrationBase } from '../MigrationBase.js';

/**
 * Document ids of the `Spell Scroll - Tier N` blanks as the magic items pack
 * shipped them.
 *
 * A snapshot, deliberately: a migration has to describe the world as it was when
 * this shipped, so it must not follow later edits to the runtime lookup table in
 * `getSpellScrollTemplateTier`.
 *
 * A set rather than a tier map, because the migration only asks whether an item
 * is one of the blanks — it rewrites the size fields and never reads a tier.
 *
 * Bare document ids rather than full compendium uuids. The ids are byte-identical
 * on the `nimble` and `nimble-dev` installs, so this needs none of the prefix
 * folding `Migration035AncestryBonusSplit` does.
 */
const TEMPLATE_IDS: ReadonlySet<string> = new Set([
	'1UL6G7MDgUqtt4fN',
	'FS6fnTIbAVk8CNSa',
	'2aE1qNnrjVjNlsMe',
	'M893NOzlKaimRo0t',
	'0txsSMjpZOhH5mW5',
	'blN77nwJUFdIfboX',
	'rRJiGuX9hFAE2zcH',
	'n8I8eqs8zYv67NA7',
	'UjUhwAWjkvdhavcp',
	'3YHEw1vfuHAFRJ2a',
]);

interface ObjectSource {
	type?: unknown;
	/** Where `MigrationBase#getSourceId` looks for the compendium the item came from. */
	_stats?: { compendiumSource?: string | null };
	flags?: { core?: { sourceId?: string } };
	system?: {
		objectSizeType?: unknown;
		slotsRequired?: unknown;
	};
}

/**
 * Retargets spell scrolls onto the small-object slot rule.
 *
 * The shipped `Spell Scroll - Tier N` blanks were authored as
 * `objectSizeType: 'slots'` with `slotsRequired: 1`, so a character carrying
 * three scrolls lost three inventory slots. Scrolls are small: the rulebook
 * groups small related items into a single slot, and
 * `NimbleCharacter#getUsedInventorySlots` charges one slot in total for every
 * small object carried rather than one each.
 *
 * Only copies of the pack blanks are touched. Scrolls inscribed by
 * `createScrollFromSpell` are already small-sized and carry no template source
 * id, so they are left alone.
 */
class Migration043SpellScrollsShareASlot extends MigrationBase {
	static override readonly version = 43;

	override readonly version = Migration043SpellScrollsShareASlot.version;

	override async updateItem(source: ObjectSource): Promise<void> {
		if (source.type !== 'object') return;

		const sourceId = this.getSourceId(source);
		if (!sourceId) return;

		const documentId = sourceId.split('.').at(-1) ?? '';
		if (!TEMPLATE_IDS.has(documentId)) return;

		if (!source.system) return;
		if (source.system.objectSizeType === 'smallSized') return;

		source.system.objectSizeType = 'smallSized';
		source.system.slotsRequired = 0;
	}
}

export { Migration043SpellScrollsShareASlot };
