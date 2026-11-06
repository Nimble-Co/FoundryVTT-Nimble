import { SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown; type?: unknown };

/** Fields of one pack rule, written only while each field in `from` still holds its old value. */
interface RuleWrite {
	ruleId: string;
	from: Record<string, unknown>;
	to: Record<string, unknown>;
}

interface PackItemSpec {
	sourceId: string;
	type: 'ancestryBonus' | 'feature';
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	/** Empty for an item with no class: the type and the name match it. */
	classIdentifier: string;
	writes: RuleWrite[];
	rules?: RuleSource[];
}

const ANCESTRY_BONUS_PREFIX = 'Compendium.nimble.nimble-ancestry-bonuses.Item.';
const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}tZkAluN0peHdleIx`,
		type: 'feature',
		name: 'fearsome beast',
		classIdentifier: 'stormshifter',
		writes: [
			{
				ruleId: 'nryMD4SgvPmMNR2s',
				from: {
					type: 'defendOption',
					useReroll: false,
					alsoInterpose: false,
					manaCost: 1,
					reminder: 'Force the attacker to reroll the attack; you choose either result.',
				},
				to: { useReroll: true, alsoInterpose: true, manaCost: 0, reminder: '', priority: 2 },
			},
		],
		rules: [
			{
				type: 'reroll',
				disabled: false,
				id: 'wY3SJTfKWw7Ga3px',
				identifier: '',
				label: 'Fearsome',
				predicate: {},
				priority: 1,
				suppressActivationCard: 'auto',
				rolls: ['attack'],
				saves: [],
				skills: [],
				abilities: [],
				keep: 'ownerChooses',
				usedBy: 'target',
				outcome: 'always',
				attackDelivery: 'any',
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 1,
				woundCost: 0,
				heroicReaction: '',
				rollModeChange: 0,
				primaryDieBonus: 0,
				extraDamage: '',
				automatic: false,
				discardedCritTriggers: false,
				oncePerRoll: true,
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}bIqEghM1BkChlRJD`,
		type: 'feature',
		name: 'burst of speed',
		classIdentifier: 'zephyr',
		writes: [
			{
				ruleId: 'sQ7cBD08i6iX6DFr',
				from: { type: 'defendOption', oncePerTurn: false },
				to: { oncePerTurn: true },
			},
			{
				ruleId: 'vdHGRNYUnBIJ7mRG',
				from: { type: 'defendOption', oncePerTurn: false },
				to: { oncePerTurn: true },
			},
		],
	},
	{
		sourceId: `${FEATURE_PREFIX}MM8MxrvZ7jnoGOa8`,
		type: 'feature',
		name: 'pocket sand',
		classIdentifier: 'the-cheat',
		writes: [
			{
				ruleId: 'gku1RZDrb18nEnP3',
				from: { type: 'defendOption', attackerCondition: 'blinded', attackerConditionEnds: '' },
				to: { attackerConditionEnds: 'attackerTurn' },
			},
		],
	},
	{
		sourceId: `${ANCESTRY_BONUS_PREFIX}1cSW678NQBiWN5m4`,
		type: 'ancestryBonus',
		name: 'bunny legs',
		classIdentifier: '',
		writes: [
			{
				ruleId: '9jawbVTzVkRToKJx',
				from: {
					type: 'defendOption',
					alsoInterpose: false,
					reminder: 'After damage, hop up to your speed in any direction.',
				},
				to: {
					alsoInterpose: true,
					reminder:
						'Hop up to your speed in any direction, before you Interpose or after the damage of a Defend.',
				},
			},
		],
	},
];

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

/** A missing field reads as its blank value: false, '' and absent are the same. */
function stored(value: unknown): unknown {
	return value === undefined || value === '' || value === false ? null : value;
}

/**
 * Gives copies of these pack items what the pack now ships: Fearsome rerolls
 * with its own Reroll rule and also on an Interpose, Burst of Speed is 1/turn,
 * Pocket Sand's Blinded ends on the attacker's turn, and Bunny Legs goes with an
 * Interpose alone.
 *
 * An item changes only when every rule it writes still holds the old pack
 * values, and no rule of the GM's own has the type of an added rule. Then all of
 * its writes are made and its rules added, so Fearsome never uses a reroll it
 * does not have.
 *
 * Matched on compendium source id (the document id, so an older pack name also
 * matches), falling back to the type, the class and the name for a copy
 * stripped of one. A second run changes nothing.
 */
class Migration079InterposeTicks extends MigrationBase {
	static override readonly version = 79;

	override readonly version = Migration079InterposeTicks.version;

	override async updateItem(source: any): Promise<void> {
		const rules = source?.system?.rules;
		if (!Array.isArray(rules)) return;

		const spec = this.#match(source);
		if (!spec) return;

		const targets = spec.writes.map((write) => ({
			write,
			rule: rules.find((rule: RuleSource) => rule?.id === write.ruleId) as RuleSource | undefined,
		}));
		const writable = targets.every(
			({ write, rule }) =>
				!!rule &&
				Object.entries(write.from).every(([key, value]) => stored(rule[key]) === stored(value)),
		);
		if (!writable || !this.#canAddRules(rules, spec)) return;

		for (const { write, rule } of targets) Object.assign(rule as RuleSource, write.to);
		for (const wanted of spec.rules ?? []) rules.push(foundry.utils.deepClone(wanted));
		console.log(`Nimble Migration | ${source.name}: updated for Interpose ticks`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId) {
			return PACK_ITEMS.find(
				(spec) => spec.type === source.type && spec.sourceId.endsWith(`.Item.${documentId}`),
			);
		}
		if (toSnapshotId(sourceId)?.startsWith('Compendium.')) return undefined;

		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) =>
				spec.type === source.type &&
				spec.name === name &&
				(!spec.classIdentifier || spec.classIdentifier === source.system.class),
		);
	}

	/** No added rule is there yet, and no rule of the GM's own has its type. */
	#canAddRules(rules: RuleSource[], spec: PackItemSpec): boolean {
		const wanted = spec.rules ?? [];
		const types = new Set(wanted.map((rule) => rule.type));
		return !rules.some((rule) => types.has(rule?.type));
	}
}

export { Migration079InterposeTicks };
