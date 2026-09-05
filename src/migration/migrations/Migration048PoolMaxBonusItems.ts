import { SYSTEM_ID } from '#system';
import { MigrationBase } from '../MigrationBase.js';

/** The "+1 Max Combat Die" class feature. */
const MAX_COMBAT_DIE_ITEM_ID = 'WnKpJ8RvCb4mX2Qt';

/** The namespace snapshot ids are written under in this file. */
const SNAPSHOT_PREFIX = 'Compendium.nimble.';

/** The namespace the running install stores and resolves uuids under. */
const INSTALLED_PREFIX = `Compendium.${SYSTEM_ID}.`;

const MAX_COMBAT_DIE_UUID = `${SNAPSHOT_PREFIX}nimble-class-features.Item.${MAX_COMBAT_DIE_ITEM_ID}`;

/** Rebrands a snapshot id to the running install, so `fromUuid` can resolve what we write. */
function toInstalledId(snapshotId: string): string {
	return `${INSTALLED_PREFIX}${snapshotId.slice(SNAPSHOT_PREFIX.length)}`;
}

/** The pools a bonus could have been recorded against, and the item that now carries each. */
const GRANT_UUID_BY_POOL: Record<string, string> = {
	'combat-dice': MAX_COMBAT_DIE_UUID,
};

interface HistoryEntry {
	level?: number;
	grantedFeatureIds?: string[];
	poolMaxBonuses?: Record<string, number>;
}

/**
 * Moves level-up pool max bonuses out of `levelUpHistory` and onto granted items.
 *
 * A bonus used to be a number on the history entry, with a single cosmetic item embedded on
 * the first pick and its name rewritten to show the running total. The bonus is now a
 * `poolMaxBonus` rule on an item, one item per pick, so the pool max is derived from what the
 * character owns and a pick can be removed by deleting its item.
 *
 * This reverses the levelUpOption half of Migration028, which swapped the option's `grantItem`
 * for a `poolMaxBonus` when the numeric record was introduced.
 */
class Migration048PoolMaxBonusItems extends MigrationBase {
	static override readonly version = 48;

	override readonly version = Migration048PoolMaxBonusItems.version;

	/** Builds one granted item carrying the bonus. */
	static #buildBonusItem(poolIdentifier: string, grantUuid: string): Record<string, unknown> {
		return {
			_id: foundry.utils.randomID(),
			name: '+1 Max Combat Die',
			type: 'feature',
			img: 'icons/sundries/gaming/dice-runed-brown.webp',
			system: {
				macro: '',
				identifier: '',
				rules: [
					{
						id: foundry.utils.randomID(),
						type: 'poolMaxBonus',
						label: '',
						disabled: false,
						predicate: [],
						priority: 1,
						poolIdentifier,
						amount: 1,
					},
				],
				description: '<p>Gain +1 to your maximum Combat Dice.</p>',
				featureType: 'class',
				class: 'commander',
				group: 'commander-progression',
				gainedAtLevel: null,
				subclass: false,
				gainedAtLevels: [],
			},
			effects: [],
			folder: null,
			flags: {},
			_stats: { compendiumSource: toInstalledId(grantUuid) },
		};
	}

	/** True if this item is a previously granted pool-bonus item, whatever it was renamed to. */
	static #isLegacyBonusItem(source: Record<string, unknown>): boolean {
		const compendiumSource =
			(source._stats as Record<string, unknown> | undefined)?.compendiumSource ?? '';
		const legacySourceId =
			(
				(source.flags as Record<string, unknown> | undefined)?.core as
					| Record<string, unknown>
					| undefined
			)?.sourceId ?? '';
		return (
			(typeof compendiumSource === 'string' && compendiumSource.includes(MAX_COMBAT_DIE_ITEM_ID)) ||
			(typeof legacySourceId === 'string' && legacySourceId.includes(MAX_COMBAT_DIE_ITEM_ID))
		);
	}

	override async updateActor(source: Record<string, unknown>): Promise<void> {
		if (source.type !== 'character') return;

		const items = source.items;
		if (!Array.isArray(items)) return;

		const system = source.system as Record<string, unknown> | undefined;
		const history = system?.levelUpHistory;
		if (!Array.isArray(history)) return;

		const entries = history as HistoryEntry[];
		if (!entries.some((entry) => Object.keys(entry?.poolMaxBonuses ?? {}).length > 0)) return;

		// The old single cosmetic item is replaced by one item per pick, so drop it first.
		// Its id may sit in a history entry's grantedFeatureIds; that is pruned below.
		const legacyIds = new Set(
			items
				.filter((item) => Migration048PoolMaxBonusItems.#isLegacyBonusItem(item))
				.map((item) => item._id as string),
		);
		source.items = items.filter((item) => !Migration048PoolMaxBonusItems.#isLegacyBonusItem(item));
		const nextItems = source.items as Record<string, unknown>[];

		let created = 0;
		for (const entry of entries) {
			const granted = Array.isArray(entry.grantedFeatureIds)
				? entry.grantedFeatureIds.filter((id) => !legacyIds.has(id))
				: [];

			for (const [poolIdentifier, amount] of Object.entries(entry.poolMaxBonuses ?? {})) {
				const grantUuid = GRANT_UUID_BY_POOL[poolIdentifier];
				// A pool with no known item cannot be represented as a grant. Leaving the number
				// in place would keep it working under the old reader, which no longer exists, so
				// the honest outcome is to drop it rather than pretend it migrated.
				if (!grantUuid) {
					console.warn(
						`Nimble Migration | ${source.name ?? 'Actor'}: no granted item is known for pool "${poolIdentifier}", dropping a bonus of ${amount}`,
					);
					continue;
				}
				if (!Number.isFinite(amount) || amount <= 0) continue;

				// One item per point, so removing a single pick removes exactly its share.
				for (let i = 0; i < amount; i += 1) {
					const item = Migration048PoolMaxBonusItems.#buildBonusItem(poolIdentifier, grantUuid);
					nextItems.push(item);
					granted.push(item._id as string);
					created += 1;
				}
			}

			entry.grantedFeatureIds = granted;
			entry.poolMaxBonuses = {};
		}

		if (created > 0) {
			console.log(
				`Nimble Migration | ${source.name ?? 'Actor'}: converted level-up pool bonuses into ${created} granted item(s)`,
			);
		}
	}

	override async updateItem(source: Record<string, unknown>): Promise<void> {
		if (source.type !== 'feature') return;

		const system = source.system as Record<string, unknown> | undefined;
		const levelUpOptions = system?.levelUpOptions;
		if (!Array.isArray(levelUpOptions)) return;

		for (const option of levelUpOptions as Record<string, unknown>[]) {
			const rules = option.rules;
			if (!Array.isArray(rules)) continue;

			let rewrote = false;
			option.rules = rules.map((rule: Record<string, unknown>) => {
				if (rule.type !== 'poolMaxBonus') return rule;
				const grantItemUuid = rule.grantItemUuid;
				// Without an item to grant there is nothing to rewrite the rule into, and the
				// reader that made the bare form work is gone, so say so rather than leave a
				// rule that silently does nothing.
				if (typeof grantItemUuid !== 'string' || grantItemUuid.length < 1) {
					console.warn(
						`Nimble Migration | ${source.name ?? 'feature'}: option "${option.id}" has a poolMaxBonus with no item to grant and can no longer take effect. Give it a grantItem rule pointing at an item that carries the bonus.`,
					);
					return rule;
				}

				rewrote = true;
				return {
					id: rule.id ?? foundry.utils.randomID(),
					type: 'grantItem',
					label: rule.label ?? '',
					disabled: rule.disabled ?? false,
					predicate: rule.predicate ?? [],
					priority: rule.priority ?? 1,
					uuid: grantItemUuid,
					allowDuplicate: true,
					inMemoryOnly: false,
					quantity: null,
				};
			});

			if (rewrote) {
				console.log(
					`Nimble Migration | ${source.name ?? 'feature'}: option "${option.id}" now grants its pool-bonus item instead of recording a number`,
				);
			}
		}
	}
}

export { Migration048PoolMaxBonusItems };
