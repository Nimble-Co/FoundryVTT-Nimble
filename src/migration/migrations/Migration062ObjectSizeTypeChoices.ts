import { OBJECT_SIZE_TYPES } from '../../models/item/ObjectDataModel.js';
import { MigrationBase } from '../MigrationBase.js';

const VALID_SIZE_TYPES = new Set<string>(OBJECT_SIZE_TYPES);

/**
 * `objectSizeType` now declares `choices`, so Foundry validates it on load and
 * drops an object carrying a value that is not on the list. A homebrew or legacy
 * object with a stray value would vanish from its owner's sheet, so anything off
 * the list is brought back to the default.
 */
class Migration062ObjectSizeTypeChoices extends MigrationBase {
	static override readonly version = 62;

	override readonly version = Migration062ObjectSizeTypeChoices.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'object') return;

		const sizeType = source.system?.objectSizeType;
		if (typeof sizeType === 'string' && VALID_SIZE_TYPES.has(sizeType)) return;

		source.system.objectSizeType = 'slots';
		console.log(
			`Nimble Migration | ${source.name}: unknown object size type ${JSON.stringify(sizeType)} reset to slots`,
		);
	}
}

export { Migration062ObjectSizeTypeChoices };
