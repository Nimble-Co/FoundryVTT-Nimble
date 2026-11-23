import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

const HALF_SPEED = 'floor(@speed / 2)';

const MOVES: Record<string, { ruleId: string; name: string }> = {
	FW8O4gZtT9qpaV8E: { ruleId: '3o31NiGWAprxPZLG', name: 'decoy' },
	GGSs5oI7c578HH9x: { ruleId: 'y6Yt3UfuhJSFwcqO', name: 'small - protect me!' },
};

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

/**
 * Gives copies of Decoy and Small Protect Me! the move the pack now ships:
 * up to half speed, away from the attacker. A rule changes only while its move
 * formula is still empty, so a distance a GM already wrote stays.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the class and the name for a copy stripped of one.
 * A second run changes nothing.
 */
class Migration095DefendOptionMove extends MigrationBase {
	static override readonly version = 95;

	override readonly version = Migration095DefendOptionMove.version;

	override readonly title = 'Defend options can move the defender';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		const move = this.#moveFor(source);
		if (source?.type !== 'feature' || !move) return;
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const rule = rules.find((candidate: RuleSource) => candidate?.id === move.ruleId) as
			| RuleSource
			| undefined;
		if (rule?.type !== 'defendOption') return;
		if (typeof rule.moveDistance === 'string' && rule.moveDistance.trim() !== '') return;

		rule.moveDistance = HALF_SPEED;
		rule.moveDirection = 'away';
		console.log(`Nimble Migration | ${source.name}: Defend offers a move`);
	}

	#moveFor(source: any): { ruleId: string; name: string } | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId && MOVES[documentId]) return MOVES[documentId];
		if (isCompendiumId(sourceId) || documentId) return undefined;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		if (source.system?.class !== 'hunter') return undefined;
		return Object.values(MOVES).find((move) => move.name === name);
	}
}

export { Migration095DefendOptionMove };
