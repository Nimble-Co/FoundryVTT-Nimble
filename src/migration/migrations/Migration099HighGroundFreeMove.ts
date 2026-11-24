import { isCompendiumId, toPackSourceId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown };

const SOURCE_ID = 'Compendium.nimble.nimble-class-features.Item.ttkDYraj2g9Nko4p';

const OLD_DESCRIPTION =
	'<p>When you roll Initiative or gain one or more Thrill of the Hunt charges, move up to half your speed for free, ignoring difficult terrain.</p>';

const NEW_DESCRIPTION = `${OLD_DESCRIPTION}<p><em>A chat card lets you choose where to stop.</em></p>`;

function freeMove(id: string, priority: number, trigger: string, chargePool: string): RuleSource {
	return {
		type: 'freeMove',
		disabled: false,
		id,
		identifier: '',
		label: 'I Have the High Ground',
		predicate: {},
		priority,
		trigger,
		poolIdentifier: '',
		chargePoolGainIdentifier: chargePool,
		distance: 'floor(@speed / 2)',
		recipient: 'self',
		within: 12,
		direction: 'any',
		ignoresDifficultTerrain: true,
		chargePoolIdentifier: '',
	};
}

const RULES: RuleSource[] = [
	freeMove('high-ground-initiative-free-move', 1, 'onInitiativeRolled', ''),
	freeMove('high-ground-charge-free-move', 2, 'onChargePoolGain', 'thrill-of-the-hunt'),
];

/**
 * Gives existing copies of I Have the High Ground the free moves the pack now
 * ships: up to half speed, ignoring difficult terrain, on Initiative and when
 * Thrill of the Hunt gains charges.
 *
 * Matched on compendium source id, falling back to class plus name for a copy
 * stripped of one. A pack rule is added unless a rule with its id is there.
 * The description changes only while it still holds the old pack value. A
 * second run changes nothing.
 */
class Migration099HighGroundFreeMove extends MigrationBase {
	static override readonly version = 99;

	override readonly version = Migration099HighGroundFreeMove.version;

	override readonly title = 'High Ground free move';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature' || !source.system || !this.#isHighGround(source)) return;

		const changed = [this.#addRules(source), this.#setDescription(source)].some(Boolean);
		if (!changed) return;

		console.log(`Nimble Migration | ${source.name}: High Ground offers its free move`);
	}

	#isHighGround(source: any): boolean {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) return sourceId === SOURCE_ID;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === 'i have the high ground' && source.system?.class === 'hunter';
	}

	#addRules(source: any): boolean {
		const system = source.system;
		if (system.rules == null) system.rules = [];
		if (!Array.isArray(system.rules)) return false;

		let changed = false;
		for (const wanted of RULES) {
			if (system.rules.some((rule: RuleSource) => rule?.id === wanted.id)) continue;
			system.rules.push(foundry.utils.deepClone(wanted));
			changed = true;
		}
		return changed;
	}

	#setDescription(source: any): boolean {
		if (source.system.description !== OLD_DESCRIPTION) return false;
		source.system.description = NEW_DESCRIPTION;
		return true;
	}
}

export { Migration099HighGroundFreeMove };
