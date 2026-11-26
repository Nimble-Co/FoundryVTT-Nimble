import { isCompendiumId, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

const MONSTERS = 'Compendium.nimble.nimble-monsters.Actor.';

/** Lowercased, for a copy that lost its compendium id. */
const FEATURE_NAME = 'haha, missed me!';

interface GoblinSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	ruleId: string;
}

const GOBLINS: GoblinSpec[] = [
	{ sourceId: `${MONSTERS}65v4ZutYxq6hlTog`, name: 'goblin', ruleId: 'HmGm9k2pQxL4sNwA' },
	{ sourceId: `${MONSTERS}KCZqQUfTuczLNEA3`, name: 'goblin minion', ruleId: 'HmMn3vR8tYb6cJdE' },
	{ sourceId: `${MONSTERS}SM6NlZaQdKqFN2AD`, name: 'goblin ratrider', ruleId: 'HmRr7wF1uZa5eKpH' },
	{
		sourceId: `${MONSTERS}XkaTxC6xYSk2kPVV`,
		name: 'goblin taskmaster',
		ruleId: 'HmTm2qC9oXs8bLnG',
	},
];

function missedMeRule(id: string): RuleSource {
	return {
		type: 'damageBack',
		disabled: false,
		id,
		identifier: '',
		label: 'Haha, Missed Me!',
		predicate: {},
		priority: 1,
		trigger: 'missed',
		attackDelivery: 'any',
		notOnAllies: false,
		onlyCrits: false,
		answeredAttack: false,
		amount: 'formula',
		formula: '1',
		damageType: 'psychic',
		ignoreArmor: true,
		woundDoubles: false,
		attackerEffectId: '',
	};
}

/**
 * Gives existing copies of the four goblins the Haha, Missed Me! rule the pack now ships:
 * 1 psychic damage to the attacker when an attack misses the goblin.
 *
 * The goblin is matched on its compendium source id, falling back to its name for a copy
 * stripped of one, and the feature by its name. The rule is added unless a rule with its id
 * is there, or the feature has an Attacker Takes rule of the GM's own. A second run changes
 * nothing.
 */
class Migration100HahaMissedMe extends MigrationBase {
	static override readonly version = 100;

	override readonly version = Migration100HahaMissedMe.version;

	override readonly title = 'Haha, Missed Me! deals damage back';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any, parent?: any): Promise<void> {
		if (source?.type !== 'monsterFeature' || !source.system) return;
		const name = String(source.name ?? '').trim();
		if (name.toLowerCase() !== FEATURE_NAME) return;
		const goblin = this.#goblinOf(parent);
		if (!goblin) return;

		const system = source.system;
		if (system.rules == null) system.rules = [];
		if (!Array.isArray(system.rules)) return;
		const rules = system.rules as RuleSource[];
		if (rules.some((rule) => rule?.id === goblin.ruleId || rule?.type === 'damageBack')) return;

		rules.push(missedMeRule(goblin.ruleId));
		console.log(`Nimble Migration | ${parent?.name}: Haha, Missed Me! deals damage back`);
	}

	#goblinOf(parent: any): GoblinSpec | undefined {
		if (!parent) return undefined;
		const sourceId = toSnapshotId(this.getSourceId(parent));
		const name = String(parent.name ?? '')
			.trim()
			.toLowerCase();
		return GOBLINS.find((spec) =>
			isCompendiumId(sourceId) ? spec.sourceId === sourceId : spec.name === name,
		);
	}
}

export { Migration100HahaMissedMe };
