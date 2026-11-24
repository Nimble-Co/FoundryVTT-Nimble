import { isCompendiumId, toPackSourceId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type Json = Record<string, any>;

interface PackFeature {
	sourceId: string;
	name: string;
	classIdentifier: string;
}

const FEATURES = 'Compendium.nimble.nimble-class-features.Item.';

const HUNTERS_MARK: PackFeature = {
	sourceId: `${FEATURES}iDYdYYMzgculnANa`,
	name: "hunter's mark",
	classIdentifier: 'hunter',
};

const PACK_HUNTER: PackFeature = {
	sourceId: `${FEATURES}xfJbfDI18kunAZu9`,
	name: 'pack hunter',
	classIdentifier: 'hunter',
};

const PACK_HUNTER_RULE: Json = {
	type: 'additionalMark',
	disabled: false,
	id: 'pack-hunter-mark',
	identifier: '',
	label: 'Pack Hunter',
	predicate: {},
	priority: 1,
	flagKey: 'quarry',
	within: 6,
};

function isRecord(value: unknown): value is Json {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Hunter's Mark ends every earlier quarry. Pack Hunter can then mark one more creature
 * within 6 spaces. Copies already edited by hand are left as they are.
 */
class Migration097EndEarlierMarks extends MigrationBase {
	static override readonly version = 97;

	override readonly version = Migration097EndEarlierMarks.version;

	override readonly title = 'A new mark ends every earlier mark';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature' || !isRecord(source.system)) return;
		if (!Array.isArray(source.system.rules)) return;
		if (this.#matches(source, HUNTERS_MARK)) this.#endEarlierMarks(source);
		else if (this.#matches(source, PACK_HUNTER)) this.#addPackHunterMark(source);
	}

	#matches(source: Json, feature: PackFeature): boolean {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) return sourceId === feature.sourceId;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === feature.name && source.system?.class === feature.classIdentifier;
	}

	#endEarlierMarks(source: Json): void {
		let changed = false;
		for (const rule of source.system.rules as unknown[]) {
			if (!isRecord(rule)) continue;
			if (rule.id !== 'hunters-mark-toggle' || rule.type !== 'markTarget') continue;
			if (rule.flagKey !== 'quarry' || rule.endEarlier === true) continue;
			rule.endEarlier = true;
			changed = true;
		}
		if (changed)
			console.log(`Nimble Migration | ${source.name}: a new quarry ends every earlier one`);
	}

	#addPackHunterMark(source: Json): void {
		const rules = source.system.rules as unknown[];
		const present = rules.some(
			(rule) =>
				isRecord(rule) &&
				(rule.id === 'pack-hunter-mark' ||
					(rule.type === 'additionalMark' && rule.flagKey === 'quarry')),
		);
		if (present) return;
		rules.push({ ...PACK_HUNTER_RULE, predicate: {} });
		console.log(`Nimble Migration | ${source.name}: can mark one more creature`);
	}
}

export { Migration097EndEarlierMarks };
