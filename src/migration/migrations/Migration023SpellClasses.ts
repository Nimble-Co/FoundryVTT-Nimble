import { MigrationBase } from '../MigrationBase.js';

const CLASS_RESTRICTED_SPELL_SOURCE_IDS = new Map<string, string[]>([
	['Compendium.nimble.spells.Item.KICmDNpyNoMuZ20E', ['shepherd']], // Lifebinding Spirit
	['Compendium.nimble.spells.Item.9TNPdOXlCcGgxw6r', ['shadowmancer']], // Shadow Blast
	['Compendium.nimble.spells.Item.ho2KADcmQWWTeYR0', ['shadowmancer']], // Summon Shadow
	['Compendium.nimble.spells.Item.kTJSEElZSzeOMXBO', ['songweaver']], // Vicious Mockery
]);

// Name-based fallback for spells in world compendiums duplicated from the official pack
// (those items may not have a compendiumSource pointing back to nimble.spells)
const CLASS_RESTRICTED_SPELL_NAMES = new Map<string, string[]>([
	['Lifebinding Spirit', ['shepherd']],
	['Shadow Blast', ['shadowmancer']],
	['Summon Shadow', ['shadowmancer']],
	['Vicious Mockery', ['songweaver']],
]);

/**
 * Migration to propagate class restrictions onto spell items that were imported
 * before the `classes` field was added to the compendium data.
 *
 * Affected spells (shepherd: Lifebinding Spirit; shadowmancer: Shadow Blast,
 * Summon Shadow; songweaver: Vicious Mockery) were added to the compendium
 * with a `classes` array, but
 * copies already living in world items, actor sheets, or duplicated world
 * compendiums still have an empty array and therefore appear on every class's
 * spell list regardless of school.
 *
 * Matching strategy:
 * 1. Source ID — canonical match for anything dragged from the official pack.
 * 2. Spell name — fallback for duplicated world compendiums where the item has
 *    no `compendiumSource`, but only when `classes` is currently empty to avoid
 *    overriding intentional GM customisation.
 */
class Migration023SpellClasses extends MigrationBase {
	static override readonly version = 23;

	override readonly version = Migration023SpellClasses.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const sourceId = this.getSourceId(source);
		const currentClasses: string[] = source.system?.classes ?? [];

		let requiredClasses: string[] | null = null;

		if (sourceId) {
			requiredClasses = CLASS_RESTRICTED_SPELL_SOURCE_IDS.get(sourceId) ?? null;
		}

		if (!requiredClasses && currentClasses.length === 0) {
			requiredClasses = CLASS_RESTRICTED_SPELL_NAMES.get(source.name) ?? null;
		}

		if (!requiredClasses) return;

		const requiredSorted = [...requiredClasses].sort().join(',');
		const currentSorted = [...currentClasses].sort().join(',');
		if (requiredSorted === currentSorted) return;

		source.system.classes = requiredClasses;
		console.log(
			`Nimble Migration | ${source.name}: set classes to [${requiredClasses.join(', ')}]`,
		);
	}
}

export { Migration023SpellClasses };
