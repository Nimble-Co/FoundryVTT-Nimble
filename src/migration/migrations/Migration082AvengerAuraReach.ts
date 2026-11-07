import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

const AVENGER_SOURCE_ID = 'Compendium.nimble.nimble-class-features.Item.S2CSClkXO6ds2NZA';
const AVENGER_RULE_ID = 'avengerDiceToMax';
const OLD_REACH = '4';
const NEW_REACH = '@auraReach';

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

/**
 * Gives copies of Avenger the reach the pack now ships: its Pool Die To Max
 * rule reads `@auraReach` in place of the fixed 4, so a larger aura also
 * reaches farther. The rule changes only while its reach is still the old 4.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the class and the name for a copy stripped of one.
 * A second run changes nothing.
 */
class Migration082AvengerAuraReach extends MigrationBase {
	static override readonly version = 82;

	override readonly version = Migration082AvengerAuraReach.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature' || !this.#isAvenger(source)) return;
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const rule = rules.find((candidate: RuleSource) => candidate?.id === AVENGER_RULE_ID) as
			| RuleSource
			| undefined;
		if (rule?.type !== 'poolDieToMax' || String(rule.reach) !== OLD_REACH) return;

		rule.reach = NEW_REACH;
		console.log(`Nimble Migration | ${source.name}: reach follows the aura`);
	}

	#isAvenger(source: any): boolean {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId) return AVENGER_SOURCE_ID.endsWith(`.Item.${documentId}`);
		if (isCompendiumId(sourceId)) return false;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === 'avenger' && source.system?.class === 'oathsworn';
	}
}

export { Migration082AvengerAuraReach };
