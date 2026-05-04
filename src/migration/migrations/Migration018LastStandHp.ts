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
 * Migration to populate `system.attributes.hp.lastStandHp` on existing
 * soloMonster actors that match the shipped legendary monsters by name.
 *
 * The Last Stand mechanic was reworked in #747: `lastStandHp` is now the heal
 * target the boss is restored to when their HP first hits 0. The shipped pack
 * JSONs are updated, but actors already imported into user worlds get
 * `lastStandHp = 0` by schema default — silently disabling Last Stand for
 * them until set manually.
 *
 * Looks up the actor's name in a static table; if matched, sets the value.
 * Skips actors whose name doesn't match (homebrew or renamed bosses) and
 * actors that already have a non-zero value (don't stomp GM customization).
 *
 * Reversibility: setting `lastStandHp` back to 0 fully disables the mechanic
 * with no other side effects.
 */
class Migration018LastStandHp extends MigrationBase {
	static override readonly version = 18;

	override readonly version = Migration018LastStandHp.version;

	override async updateActor(source: any): Promise<void> {
		if (source.type !== 'soloMonster') return;
		const hp = source.system?.attributes?.hp;
		if (!hp) return;
		if (typeof hp.lastStandHp === 'number' && hp.lastStandHp > 0) return;

		const value = LAST_STAND_HP_BY_NAME[source.name];
		if (value === undefined) return;

		hp.lastStandHp = value;
	}
}

export { Migration018LastStandHp };
