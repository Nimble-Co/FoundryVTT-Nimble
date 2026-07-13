import { MigrationBase } from '../MigrationBase.js';

// AoE behavior (chat-card placement, auto-place, and the shared-roll
// crit/miss rule) now gates on `activation.acquireTargetsFromTemplate`
// instead of treating any template shape as AoE — a bare shape can be a
// stale leftover in item data. Two spells shipped with mismatched data that
// the compendium sources have since corrected; this migration repairs copies
// already living on actors, in world items, or in duplicated world
// compendiums:
//
// - Pyroclasm is an AoE spell (radius-3 circle) but shipped without the
//   flag. Without it the spell loses AoE crit/miss handling and never
//   offers placement.
// - Boisterous Winds is multi-target, not AoE, but shipped with a stale
//   default square template shape.
const PYROCLASM_SOURCE_IDS = new Set([
	'Compendium.nimble.spells.Item.merFlbZYKSiTvPUN',
	'Compendium.nimble.nimble-spells.Item.merFlbZYKSiTvPUN',
]);
const PYROCLASM_NAME = 'Pyroclasm';

const BOISTEROUS_WINDS_SOURCE_IDS = new Set([
	'Compendium.nimble.spells.Item.VUAcS7huPbffPGMk',
	'Compendium.nimble.nimble-spells.Item.VUAcS7huPbffPGMk',
]);
const BOISTEROUS_WINDS_NAME = 'Boisterous Winds';

/**
 * Migration to reconcile shipped spell data with the AoE template flag.
 *
 * Matching strategy (same as Migration026):
 * 1. Source ID — canonical match for anything dragged from the official pack.
 * 2. Spell name — fallback for duplicated world compendiums where the item has
 *    no `compendiumSource`.
 *
 * In both cases the fix is only applied when the spell still carries the exact
 * shipped broken state, so intentional GM edits are left untouched.
 */
class Migration028AoETemplateFlags extends MigrationBase {
	static override readonly version = 28;

	override readonly version = Migration028AoETemplateFlags.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const activation = source.system?.activation;
		const template = activation?.template;
		if (!activation || !template || activation.acquireTargetsFromTemplate) return;

		const sourceId = this.getSourceId(source);

		const isPyroclasm =
			(sourceId && PYROCLASM_SOURCE_IDS.has(sourceId)) || source.name === PYROCLASM_NAME;
		if (isPyroclasm && template.shape === 'circle') {
			activation.acquireTargetsFromTemplate = true;
			console.log(
				`Nimble Migration | ${source.name}: flagged as AoE so it places a template and uses the shared AoE roll`,
			);
			return;
		}

		const isBoisterousWinds =
			(sourceId && BOISTEROUS_WINDS_SOURCE_IDS.has(sourceId)) ||
			source.name === BOISTEROUS_WINDS_NAME;
		if (isBoisterousWinds && template.shape === 'square') {
			template.shape = '';
			console.log(`Nimble Migration | ${source.name}: cleared stale template shape`);
		}
	}
}

export { Migration028AoETemplateFlags };
