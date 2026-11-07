import { MigrationBase } from '../MigrationBase.js';

/**
 * Gives a free reaction the one cost shape: `type: 'action'` with `quantity: 0`
 * and `isReaction`. The old shape `type: 'none'` with `isReaction` cost 0
 * actions too, but showed no reaction words. Other units stay as they are.
 * A second run changes nothing.
 */
class Migration083FreeReactionCost extends MigrationBase {
	static override readonly version = 83;

	override readonly version = Migration083FreeReactionCost.version;

	override async updateItem(source: any): Promise<void> {
		const cost = source?.system?.activation?.cost;
		if (cost?.isReaction !== true || cost.type !== 'none') return;

		cost.type = 'action';
		cost.quantity = 0;
		console.log(`Nimble Migration | ${source.name}: free reaction cost`);
	}
}

export { Migration083FreeReactionCost };
