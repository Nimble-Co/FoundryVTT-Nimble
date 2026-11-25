import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

const FORMULA = '1d4+@level';

const OLD_REMINDER = 'Your companion may first attack the attacker for 1d4+LVL damage.';

const ATTACKS: Record<string, { ruleId: string; name: string }> = {
	WpTBjJEqfLhiA37M: { ruleId: 'CLmYUbqdoPRDkIMw', name: 'medium - protect me!' },
};

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

/**
 * Gives copies of Medium Protect Me! the attack the pack now ships: 1d4+@level
 * against the attacker. A rule changes only while its attack formula is still
 * empty, so a formula a GM already wrote stays. The old reminder line for that
 * attack goes while it still holds the shipped text. A second run changes nothing.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the class and the name for a copy stripped of one.
 */
class Migration096DefendOptionAttack extends MigrationBase {
	static override readonly version = 96;

	override readonly version = Migration096DefendOptionAttack.version;

	override readonly title = 'Defend options can damage the attacker';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		const attack = this.#attackFor(source);
		if (source?.type !== 'feature' || !attack) return;
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const rule = rules.find((candidate: RuleSource) => candidate?.id === attack.ruleId) as
			| RuleSource
			| undefined;
		if (rule?.type !== 'defendOption') return;
		if (rule.reminder === OLD_REMINDER) rule.reminder = '';
		if (typeof rule.attackFormula === 'string' && rule.attackFormula.trim() !== '') return;

		rule.attackFormula = FORMULA;
		console.log(`Nimble Migration | ${source.name}: Defend offers an attack`);
	}

	#attackFor(source: any): { ruleId: string; name: string } | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId && ATTACKS[documentId]) return ATTACKS[documentId];
		if (isCompendiumId(sourceId) || documentId) return undefined;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		if (source.system?.class !== 'hunter') return undefined;
		return Object.values(ATTACKS).find((attack) => attack.name === name);
	}
}

export { Migration096DefendOptionAttack };
