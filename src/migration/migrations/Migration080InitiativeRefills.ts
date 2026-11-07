import { isCompendiumId, SNAPSHOT_PREFIX, toSnapshotId } from '../compendiumSourceId.js';
import { MigrationBase } from '../MigrationBase.js';

type RuleSource = Record<string, unknown> & { id?: unknown };
type RefillEntry = Record<string, unknown>;

/** One refill entry of a pack rule, changed only while it still holds the old pack values. */
interface RefillWrite {
	ruleId: string;
	field: 'recoveries' | 'addRefills';
	mode: string;
	value: string;
	temporary: boolean;
	label?: { from: string; to: string };
}

interface PackItemSpec {
	sourceId: string;
	/** Lowercased, for a copy that lost its compendium id. */
	name: string;
	classIdentifier: string;
	write: RefillWrite;
}

const FEATURE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

const PACK_ITEMS: PackItemSpec[] = [
	{
		sourceId: `${FEATURE_PREFIX}bIqEghM1BkChlRJD`,
		name: 'burst of speed',
		classIdentifier: 'zephyr',
		write: {
			ruleId: '0LC1CfBCCPWhE36H',
			field: 'recoveries',
			mode: 'set',
			value: '@dexterity',
			temporary: false,
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}v4ihiCbIfuwNmx4v`,
		name: 'windborne',
		classIdentifier: 'zephyr',
		write: {
			ruleId: '2jVESm2CSajGf7M0',
			field: 'addRefills',
			mode: 'add',
			value: '1',
			temporary: false,
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}qbrHOGpSY2thczfu`,
		name: 'master commander',
		classIdentifier: 'commander',
		write: {
			ruleId: 'master-commander-initiative-regain',
			field: 'addRefills',
			mode: 'add',
			value: '1',
			temporary: true,
			label: {
				from: 'Master Commander: regain 1 use of Coordinated Strike on initiative',
				to: 'Master Commander: regain 1 use of Coordinated Strike when you roll Initiative',
			},
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}4Iu4tRnP8kBJd2ra`,
		name: 'survey the battlefield.',
		classIdentifier: 'commander',
		write: {
			ruleId: 'survey-the-battlefield-initiative-regain',
			field: 'addRefills',
			mode: 'add',
			value: '1',
			temporary: false,
			label: {
				from: 'Survey the Battlefield: regain 1 use of Coordinated Strike on initiative',
				to: 'Survey the Battlefield: regain 1 use of Coordinated Strike when you roll Initiative',
			},
		},
	},
	{
		sourceId: `${FEATURE_PREFIX}hGEoVMVk2Wor4fnR`,
		name: 'heart of burning fire',
		classIdentifier: 'shadowmancer',
		write: {
			ruleId: 'heart-of-burning-fire-initiative-regain',
			field: 'addRefills',
			mode: 'add',
			value: '1',
			temporary: true,
			label: {
				from: 'Heart of Burning Fire: regain 1 use of Pilfered Power on initiative',
				to: 'Heart of Burning Fire: regain 1 use of Pilfered Power when you roll Initiative',
			},
		},
	},
];

/** The document id of a copy from any pack of this system, also an older pack name. */
function packDocumentId(sourceId: string | undefined): string | undefined {
	const snapshotId = toSnapshotId(sourceId);
	if (!snapshotId?.startsWith(SNAPSHOT_PREFIX)) return undefined;
	const match = /\.Item\.([^.]+)$/.exec(snapshotId);
	return match?.[1];
}

function isOldEntry(entry: RefillEntry, write: RefillWrite): boolean {
	return (
		entry?.trigger === 'encounterStart' &&
		entry.mode === write.mode &&
		entry.value === write.value &&
		!entry.temporary
	);
}

/**
 * Moves the five "when you roll Initiative" refills of Burst of Speed,
 * Windborne, Master Commander, Survey the Battlefield and Heart of Burning Fire
 * from `encounterStart` to `onInitiativeRolled`. Master Commander and Heart of
 * Burning Fire also get a temporary refill, because the use is lost at the end
 * of the encounter if it is not spent. The old label of a rule changes only
 * while it is the old pack label.
 *
 * An item changes only when its rule still has one refill entry with the old
 * pack values. Matched on compendium source id (the document id, so an older
 * pack name also matches), falling back to the class and the name for a copy
 * stripped of one. A second run changes nothing.
 */
class Migration080InitiativeRefills extends MigrationBase {
	static override readonly version = 80;

	override readonly version = Migration080InitiativeRefills.version;

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature') return;
		const rules = source.system?.rules;
		if (!Array.isArray(rules)) return;

		const spec = this.#match(source);
		if (!spec) return;
		const { write } = spec;

		const rule = rules.find((candidate: RuleSource) => candidate?.id === write.ruleId) as
			| RuleSource
			| undefined;
		const entries = rule?.[write.field];
		if (!rule || !Array.isArray(entries)) return;
		const old = entries.filter((entry: RefillEntry) => isOldEntry(entry, write));
		if (old.length !== 1) return;

		old[0].trigger = 'onInitiativeRolled';
		if (write.temporary) old[0].temporary = true;
		if (write.label && rule.label === write.label.from) rule.label = write.label.to;
		console.log(`Nimble Migration | ${source.name}: refills when you roll Initiative`);
	}

	#match(source: any): PackItemSpec | undefined {
		const sourceId = this.getSourceId(source);
		const documentId = packDocumentId(sourceId);
		if (documentId) {
			return PACK_ITEMS.find((spec) => spec.sourceId.endsWith(`.Item.${documentId}`));
		}
		if (isCompendiumId(sourceId)) return undefined;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return PACK_ITEMS.find(
			(spec) => spec.name === name && spec.classIdentifier === source.system.class,
		);
	}
}

export { Migration080InitiativeRefills };
