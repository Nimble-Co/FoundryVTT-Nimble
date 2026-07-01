import { MigrationBase } from '../MigrationBase.js';

// Ignite is a single-target spell ("Damage: 4d10 to a Smoldering target") that
// shipped with an AoE circle template. `ItemActivationManager` treats any
// template shape as AoE and forces canMiss/canCrit off (AoE uses one shared
// roll), so Ignite's explicit canMiss/canCrit were overridden and a 1 on the
// primary die never registered as a miss (issue #835). The compendium source
// was corrected to clear the template; this migration repairs copies already
// living on actors, in world items, or in duplicated world compendiums.
const IGNITE_SOURCE_IDS = new Set([
	'Compendium.nimble.spells.Item.FL6JcWWzAjdMchhJ',
	'Compendium.nimble.nimble-spells.Item.FL6JcWWzAjdMchhJ',
]);
const IGNITE_NAME = 'Ignite';

/**
 * Migration to clear Ignite's stray AoE circle template so it can miss and crit.
 *
 * Matching strategy:
 * 1. Source ID — canonical match for anything dragged from the official pack.
 * 2. Spell name — fallback for duplicated world compendiums where the item has
 *    no `compendiumSource`.
 *
 * In both cases the fix is only applied when the spell still carries the broken
 * `circle` template, so intentional GM edits (e.g. reshaping it into a real
 * AoE) are left untouched.
 */
class Migration026IgniteSingleTarget extends MigrationBase {
	static override readonly version = 26;

	override readonly version = Migration026IgniteSingleTarget.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const sourceId = this.getSourceId(source);
		const isIgnite = (sourceId && IGNITE_SOURCE_IDS.has(sourceId)) || source.name === IGNITE_NAME;
		if (!isIgnite) return;

		const activation = source.system?.activation;
		const template = activation?.template;
		// Only repair the specific broken state; leave intentional GM edits alone.
		if (!template || template.shape !== 'circle') return;

		template.shape = '';
		template.radius = 1;
		activation.acquireTargetsFromTemplate = false;

		console.log(`Nimble Migration | ${source.name}: cleared AoE template so it can miss and crit`);
	}
}

export { Migration026IgniteSingleTarget };
