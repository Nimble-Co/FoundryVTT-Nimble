import { toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

interface BanditSpec {
	actorSourceId: string;
	actorName: string;
	ruleId: string;
}

const BANDITS: BanditSpec[] = [
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.9WKy1tqSaiffgo3r',
		actorName: 'bandit assassin',
		ruleId: 'tu8msMD6Vql8QnoK',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.b4xQqvIabCUfsJDT',
		actorName: 'bandit bruiser',
		ruleId: '4qlPLRQUGBjM09Yp',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.dteeb6x2NSNbgvqS',
		actorName: 'bandit captain',
		ruleId: 'VHTJH3rJ6ZPDkKbB',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.ZlCEjSKWexX3OOYz',
		actorName: 'bandit hunter',
		ruleId: '2PNINTsA5RlvXHrK',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.DO4C8oN9LxSqK6XG',
		actorName: 'bandit mage',
		ruleId: '3TYU94lHKUs0N95b',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.FOQD0sLrhJiSM9sK',
		actorName: 'bandit minion',
		ruleId: 'DdlfAVZ9HQuT3tYA',
	},
	{
		actorSourceId: 'Compendium.nimble.nimble-monsters.Actor.r9NnB02qiXpLFrcP',
		actorName: 'bandit',
		ruleId: 'HO3TDlnuYvNiYEP8',
	},
];

/**
 * Adds the Parry miss-threshold rule to Bandits imported before the pack gained
 * that automation. Existing threshold rules are left untouched so a GM's
 * customization wins, and matching by source id survives actor renames.
 */
class Migration066BanditParry extends MigrationBase {
	static override readonly version = 66;

	override readonly version = Migration066BanditParry.version;

	override async updateItem(source: any, parent?: any): Promise<void> {
		if (!parent || source?.type !== 'feature' || source.name !== 'Parry.') return;

		const bandit = this.#matchBandit(parent);
		if (!bandit) return;

		const system = (source.system ??= {} as Record<string, unknown>);
		const rules: Array<Record<string, unknown>> = Array.isArray(system.rules)
			? system.rules
			: (system.rules = []);
		if (
			rules.some(
				(rule) => rule.type === 'modifyIncomingAttack' && rule.modifier === 'raiseMissThreshold',
			)
		) {
			return;
		}

		rules.push({
			type: 'modifyIncomingAttack',
			modifier: 'raiseMissThreshold',
			missThreshold: 2,
			label: '',
			id: bandit.ruleId,
		});
		console.log(`Nimble Migration | ${parent.name} > ${source.name}: added Parry threshold`);
	}

	#matchBandit(parent: any): BanditSpec | undefined {
		const sourceId = toSnapshotId(this.getSourceId(parent));
		if (sourceId?.startsWith('Compendium.')) {
			return BANDITS.find((bandit) => bandit.actorSourceId === sourceId);
		}

		const actorName = String(parent.name ?? '')
			.trim()
			.toLowerCase();
		return BANDITS.find((bandit) => bandit.actorName === actorName);
	}
}

export { Migration066BanditParry };
