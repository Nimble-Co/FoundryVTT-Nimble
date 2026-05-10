import { MigrationBase } from '../MigrationBase.js';

/**
 * Canonical Last Stand HP buffer values for the legendary monsters shipped in
 * the core pack, taken from the GM Guide's stat blocks. Three entries are
 * intentionally `0` — their Last Stand is a death-time effect (no buffer):
 * Dregatha (curse), Kelebek (Poppy-linked), Titan (collapses into minions).
 */
const LAST_STAND_HP_BY_NAME: Record<string, number> = {
	'Alaric Draegoth, the Crimson Count': 160,
	'Azriel, Lord of Pain & Flame': 180,
	'Caerys, the Hollow Star': 200,
	'Dravok, All-Seeing Tyrant': 70,
	'Dregatha, Thrice-Chinned': 0,
	'Florindris, Bane of the Forest': 70,
	'General Flameheart': 80,
	'Gloomwing the Cruel': 150,
	'Greenthumb, Lichling': 30,
	'Grimbeak, the Unyielding': 30,
	'Kelebek, Entomancer': 0,
	'Krogg, Goblin King': 20,
	'Nalzar, Apex Predator': 60,
	'Pudge the Blunderer': 20,
	'Queen Aranya, Broodmother': 40,
	'Ravager of the Lowlands': 40,
	'Thorn Quickblade': 30,
	'Titan of the Deep Woods': 0,
	"Ul'vek, Psionic Despot": 110,
	'Vael, Undying Necromancer': 90,
};

/**
 * Migration to populate `lastStandHp` on the embedded `monsterFeature` item
 * with `subtype: 'lastStand'` for actors that match the shipped legendary
 * monsters by name.
 *
 * The Last Stand mechanic was reworked in #747: configuration moved from the
 * actor's `system.attributes.hp.lastStandHp` to the Last Stand feature item's
 * `system.lastStandHp`. Existing imported actors otherwise get the schema
 * default of 0 on the item, silently disabling Last Stand until set manually.
 *
 * Resolution order on each actor:
 * 1. Skip if there's no `subtype: 'lastStand'` item to attach the value to.
 * 2. Skip if the item already has a positive `lastStandHp` (don't stomp).
 * 3. Use any leftover `system.attributes.hp.lastStandHp` from the previous
 *    schema version, then clear it.
 * 4. Otherwise fall back to the by-name table for shipped monsters.
 *
 * Skips actors whose name doesn't match the table (homebrew or renamed
 * bosses) — those GMs configure the item manually via the feature sheet.
 */
class Migration018LastStandHp extends MigrationBase {
	static override readonly version = 18;

	override readonly version = Migration018LastStandHp.version;

	override async updateActor(source: any): Promise<void> {
		const items = Array.isArray(source.items) ? source.items : null;
		if (!items) return;

		const lastStandItem = items.find(
			(item: any) => item?.type === 'monsterFeature' && item?.system?.subtype === 'lastStand',
		);
		if (!lastStandItem?.system) return;
		if (
			typeof lastStandItem.system.lastStandHp === 'number' &&
			lastStandItem.system.lastStandHp > 0
		) {
			return;
		}

		const stale = source.system?.attributes?.hp?.lastStandHp;
		const carryOver = typeof stale === 'number' && stale > 0 ? stale : null;
		const fallback = LAST_STAND_HP_BY_NAME[source.name];
		const value = carryOver ?? fallback;
		if (value === undefined) return;

		lastStandItem.system.lastStandHp = value;
		if (typeof stale === 'number') {
			delete source.system.attributes.hp.lastStandHp;
		}
	}
}

export { Migration018LastStandHp };
