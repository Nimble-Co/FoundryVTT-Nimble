import { toPackSourceId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

const SOURCE_ID = 'Compendium.nimble.nimble-class-features.Item.gIiIeUH88mxDBDAV';

// Kept in sync with packs/classFeatures/core/hunter/hunter-progression/versatile-bowmaster.json
const RULES = [
	{
		type: 'damageFormulaChoice',
		disabled: false,
		id: 'versatile-bowmaster-longbow',
		identifier: '',
		label: 'Versatile Bowmaster',
		predicate: {},
		priority: 1,
		itemIdentifier: 'longbow',
		from: '1d8',
		to: '2d4',
	},
	{
		type: 'damageFormulaChoice',
		disabled: false,
		id: 'versatile-bowmaster-crossbow',
		identifier: '',
		label: 'Versatile Bowmaster',
		predicate: {},
		priority: 1,
		itemIdentifier: 'crossbow',
		from: '4d4',
		to: '2d8',
	},
];

type RuleSource = { id?: unknown; [key: string]: unknown };

/**
 * Adds the Versatile Bowmaster damage-formula ticks to embedded copies of the
 * feature. Pack edits do not reach a copy a character already has.
 */
class Migration098VersatileBowmaster extends MigrationBase {
	static override readonly version = 98;

	override readonly version = Migration098VersatileBowmaster.version;

	override readonly title = 'Versatile Bowmaster damage dice';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature' || !this.#matches(source)) return;
		const system = (source.system ??= {} as Record<string, unknown>);
		if (!Array.isArray(system.rules)) system.rules = [];
		const rules = system.rules as RuleSource[];
		for (const canonical of RULES) {
			const index = rules.findIndex((rule) => rule?.id === canonical.id);
			const copy = foundry.utils.deepClone(canonical);
			if (index >= 0) rules[index] = copy;
			else rules.push(copy);
		}
	}

	#matches(source: any): boolean {
		if (toPackSourceId(this.getSourceId(source)) === SOURCE_ID) return true;
		if (source?.system?.class !== 'hunter') return false;
		return (
			typeof source.name === 'string' && source.name.trim().toLowerCase() === 'versatile bowmaster'
		);
	}
}

export { Migration098VersatileBowmaster };
