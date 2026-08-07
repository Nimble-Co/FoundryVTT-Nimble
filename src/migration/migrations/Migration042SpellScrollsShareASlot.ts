import {
	documentIdFromUuid,
	TIER_BY_SPELL_SCROLL_TEMPLATE_ID,
} from '../../utils/getSpellScrollTemplateTier.js';
import { MigrationBase } from '../MigrationBase.js';

interface ObjectSource {
	type?: unknown;
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
export class Migration042SpellScrollsShareASlot extends MigrationBase {
	static override readonly version = 42;

	override readonly version = Migration042SpellScrollsShareASlot.version;

	override async updateItem(source: ObjectSource): Promise<void> {
		if (source.type !== 'object') return;

		const sourceId = this.getSourceId(source);
		if (!sourceId) return;

		const tier = TIER_BY_SPELL_SCROLL_TEMPLATE_ID[documentIdFromUuid(sourceId)];
		if (typeof tier !== 'number') return;

		if (!source.system) return;
		if (source.system.objectSizeType === 'smallSized') return;

		source.system.objectSizeType = 'smallSized';
		source.system.slotsRequired = 0;
	}
}
