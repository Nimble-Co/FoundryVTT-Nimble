import { MigrationBase } from '../MigrationBase.js';

// Shadow Trap shipped with no damage at all: its 3d12 lands on the next
// creature to move adjacent, which the activation cannot know about, so there
// was nothing sensible to roll when the card posted (issue #370). The
// compendium source now carries a deferred damage node, which posts unrolled
// and offers a Roll Damage button; this migration adds it to copies already
// living on actors, in world items, or in duplicated world compendiums.
// Both pack namespaces the id has been written under, each in the stable and
// the dev-rebrand system namespace. `dev-rebrand.mjs` only rewrites
// `packs/**/*.json`, so on the dev build an actor's copy stores
// `Compendium.nimble-dev.…` and would otherwise fall through to the weaker
// name match. See AGENTS.md, "Audited exceptions".
const SHADOW_TRAP_SOURCE_IDS = new Set([
	'Compendium.nimble.spells.Item.aoCnJhoJji5s5Etf',
	'Compendium.nimble.nimble-spells.Item.aoCnJhoJji5s5Etf',
	'Compendium.nimble-dev.spells.Item.aoCnJhoJji5s5Etf',
	'Compendium.nimble-dev.nimble-spells.Item.aoCnJhoJji5s5Etf',
]);
const SHADOW_TRAP_NAME = 'Shadow Trap';

// The compendium node's own id, so an actor's copy and the source stay in step.
const SHADOW_TRAP_DAMAGE_NODE_ID = 'tMyTaEsCtivi63VN';

/**
 * Migration to give Shadow Trap the deferred damage node its chat card needs.
 *
 * Matching strategy:
 * 1. Source ID — canonical match for anything dragged from the official pack.
 * 2. Spell name — fallback for duplicated world compendiums where the item has
 *    no `compendiumSource`.
 *
 * Skipped whenever the spell already carries damage of any kind, so a GM who
 * automated it themselves keeps their version rather than getting a second
 * 3d12 alongside it.
 */
class Migration046ShadowTrapDeferredDamage extends MigrationBase {
	static override readonly version = 46;

	override readonly version = Migration046ShadowTrapDeferredDamage.version;

	override async updateItem(source: any): Promise<void> {
		if (source.type !== 'spell') return;

		const sourceId = this.getSourceId(source);
		const isShadowTrap =
			(sourceId && SHADOW_TRAP_SOURCE_IDS.has(sourceId)) || source.name === SHADOW_TRAP_NAME;
		if (!isShadowTrap) return;

		const effects = source.system?.activation?.effects;
		if (!Array.isArray(effects)) return;
		if (effects.some((effect: any) => effect?.type === 'damage')) return;

		effects.push({
			id: SHADOW_TRAP_DAMAGE_NODE_ID,
			type: 'damage',
			damageType: 'necrotic',
			formula: '3d12',
			deferredRoll: true,
			canCrit: false,
			canMiss: false,
			ignoreArmor: false,
			on: {},
			parentContext: null,
			parentNode: null,
		});

		console.log(`Nimble Migration | ${source.name}: added deferred 3d12 necrotic damage`);
	}
}

export { Migration046ShadowTrapDeferredDamage };
