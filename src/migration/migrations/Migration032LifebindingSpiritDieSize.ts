import { MigrationBase } from '../MigrationBase.js';

const LIFEBINDING_SPIRIT_SOURCE_IDS = new Set([
	'Compendium.nimble.spells.Item.KICmDNpyNoMuZ20E',
	'Compendium.nimble.nimble-spells.Item.KICmDNpyNoMuZ20E',
]);
const LIFEBINDING_SPIRIT_NAME = 'Lifebinding Spirit';

// Canonical scaling mirroring the pack JSON after the die-size upcast operation
// was added. Kept in sync with:
//   packs/spells/core/radiant/lifebinding-spirit.json
const LIFEBINDING_SPIRIT_SCALING = {
	mode: 'upcast',
	deltas: [
		{
			operation: 'increaseDieSize',
			value: 1,
			dice: null,
			condition: null,
			targetEffectId: null,
			durationType: null,
			maxDieFaces: 12,
		},
	],
	choices: null,
};

/**
 * Migration to make existing Lifebinding Spirit copies upcastable.
 *
 * The scaling engine could not express "increment its die size by 1 (max d12)"
 * until the `increaseDieSize` operation was added, so the spell shipped with no
 * `scaling` entry at all and `validateAndComputeUpcast` rejected every upcast
 * with "This spell cannot be upcast" (issue #845). The compendium source now
 * carries the scaling; this migration repairs copies already living on actors,
 * in world items, or in duplicated world compendiums.
 *
 * Matching strategy mirrors the other spell repairs:
 * 1. Source ID — canonical match for anything dragged from the official pack.
 * 2. Spell name — fallback for duplicated world compendiums where the item has
 *    no `compendiumSource`.
 *
 * Spells that already carry scaling deltas are left alone so GM-authored
 * upcast rules are never overwritten.
 */
class Migration032LifebindingSpiritDieSize extends MigrationBase {
	static override readonly version = 32;

	override readonly version = Migration032LifebindingSpiritDieSize.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const sourceId = this.getSourceId(source);
		const isLifebindingSpirit =
			(sourceId && LIFEBINDING_SPIRIT_SOURCE_IDS.has(sourceId)) ||
			source.name === LIFEBINDING_SPIRIT_NAME;
		if (!isLifebindingSpirit) return;

		const scaling = source.system?.scaling;
		const hasAuthoredScaling =
			(scaling?.mode && scaling.mode !== 'none') ||
			scaling?.deltas?.length > 0 ||
			scaling?.choices?.length > 0;
		if (hasAuthoredScaling) return;

		source.system ??= {};
		source.system.scaling = foundry.utils.deepClone(LIFEBINDING_SPIRIT_SCALING);

		console.log(`Nimble Migration | ${source.name}: enabled die-size upcast scaling (max d12)`);
	}
}

export { Migration032LifebindingSpiritDieSize };
