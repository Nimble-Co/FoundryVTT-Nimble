import { MigrationBase } from '../MigrationBase.js';

const RAGE_SOURCE_ID = 'Compendium.nimble.class-features.Item.GjPt8evcIoVuQ6zg';

// Mirrors the pack JSON for Rage. The migration is idempotent — it only
// inserts a node if no node with the same `id` is already present on the
// item's activation.effects tree.

const RAGE_ACTIVATION_NODES = [
	{
		id: 'rage-fury-l1',
		type: 'pool',
		poolType: 'dice',
		action: 'rollDie',
		poolIdentifier: 'fury',
		value: 1,
		predicate: { level: { max: 4 } },
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'rage-fury-l5',
		type: 'pool',
		poolType: 'dice',
		action: 'rollDie',
		poolIdentifier: 'fury',
		value: 2,
		predicate: { level: { min: 5 } },
		parentContext: null,
		parentNode: null,
	},
];

const ACTIVATION_NODE_BACKFILL_BY_SOURCE_ID: Record<
	string,
	ReadonlyArray<Record<string, unknown>>
> = {
	[RAGE_SOURCE_ID]: RAGE_ACTIVATION_NODES,
};

/**
 * Backfills `pool` activation-effect nodes onto embedded copies of Rage
 * so its activation rolls a Fury Die (or two at level 5+) into the pool.
 *
 * Matches strictly on compendium source id; homebrew copies are left alone.
 * Idempotent: inserts a node only if no node with the same `id` is present.
 */
class Migration020RagePoolActivation extends MigrationBase {
	static override readonly version = 20;

	override readonly version = Migration020RagePoolActivation.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'feature') return;
		const sourceId = this.getSourceId(source);
		if (!sourceId) return;

		const backfill = ACTIVATION_NODE_BACKFILL_BY_SOURCE_ID[sourceId];
		if (!backfill) return;

		const activation = (source.system ??= {} as Record<string, unknown>).activation ?? {};
		source.system.activation = activation;
		if (!Array.isArray(activation.effects)) {
			activation.effects = [];
		}

		const existingIds = new Set<string>(
			(activation.effects as Array<{ id?: unknown }>)
				.map((node) => (typeof node?.id === 'string' ? node.id : null))
				.filter((id: string | null): id is string => id !== null),
		);

		let added = 0;
		for (const node of backfill) {
			const nodeId = node.id as string | undefined;
			if (nodeId && existingIds.has(nodeId)) continue;
			activation.effects.push(foundry.utils.deepClone(node));
			added += 1;
		}

		if (added > 0) {
			// eslint-disable-next-line no-console
			console.log(
				`Nimble Migration | ${source.name ?? sourceId}: backfilled ${added} pool activation node(s)`,
			);
		}
	}
}

export { Migration020RagePoolActivation };
