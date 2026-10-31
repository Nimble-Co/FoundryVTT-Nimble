import { describe, expect, it } from 'vitest';
import {
	effectsMonster,
	effectsMonsterContext,
	goblin,
	minion,
	monsterContext,
	soloMonster,
} from '../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { monsterFrame } from '../monsterFrame.ts';
import { monsterRail } from '../monsterRail.ts';

const RAIL = 'NIMBLE.actorSheet.monster.rail';

describe('monsterRail', () => {
	it.each([
		[goblin(), 'npc', { level: '1/3', size: 'Small', type: 'Goblins' }],
		[goblin({ system: { details: { isFlunky: true } } }), 'flunky', { level: '1/3' }],
		[soloMonster(), 'soloMonster', { level: '2', size: 'Large', type: 'Ogre' }],
		[minion(), 'minion', { level: '1/4', size: 'Small', type: 'Kobolds' }],
	])('names the level, size and creature type: %#', (actor, kind, data) => {
		const meta = monsterRail(actor, monsterContext()).meta;

		expect(meta.startsWith(`${RAIL}.meta.${kind} `)).toBe(true);
		expect(JSON.parse(meta.slice(meta.indexOf('{')))).toMatchObject(data);
	});

	it('gives the HP, and says Bloodied at half HP or less', () => {
		const context = monsterContext();

		expect(monsterRail(goblin(), context).hp).toMatchObject({ value: 15, max: 15, state: null });
		expect(
			monsterRail(goblin({ system: { attributes: { hp: { value: 7, temp: 2 } } } }), context).hp,
		).toMatchObject({ value: 7, temp: 2, state: 'NIMBLE.conditions.bloodied' });
		expect(
			monsterRail(goblin({ system: { attributes: { hp: { value: 0 } } } }), context).hp?.state,
		).toBeNull();
	});

	it('gives a minion no HP and the minion rules', () => {
		const rail = monsterRail(minion(), monsterContext());

		expect(rail.hp).toBeNull();
		expect(rail.minionRules).toEqual([`${RAIL}.minion.noHp`, `${RAIL}.minion.noCrit`]);
		expect(monsterRail(goblin(), monsterContext()).minionRules).toBeNull();
	});

	it('gives each save with its advantage, and a click rolls it', () => {
		const saves = monsterRail(soloMonster(), monsterContext()).saves;

		expect(saves.map((save) => [save.key, save.mod, save.advantage])).toEqual([
			['strength', '+0', 1],
			['dexterity', '+0', 0],
			['intelligence', '+0', -1],
			['will', '+0', 0],
		]);
		expect(saves[1].intent).toEqual({ kind: 'rollSave', save: 'dexterity' });
	});

	it('reads the armor from system.attributes.armor', () => {
		const armorOf = (armor: string) =>
			monsterRail(goblin({ system: { attributes: { armor } } }), monsterContext()).stats[0];

		expect(armorOf('heavy')).toMatchObject({ id: 'armor', value: 'H' });
		expect(armorOf('heavy').tooltip).toContain('NIMBLE.armorTypes.heavy');
		expect(armorOf('medium').value).toBe('M');
		expect(armorOf('none').value).toBe('–');
	});

	it('offers the three armor choices for edit mode, with the armor of the monster', () => {
		const armor = monsterRail(
			goblin({ system: { attributes: { armor: 'medium' } } }),
			monsterContext(),
		).armor;

		expect(armor.value).toBe('medium');
		expect(armor.label).toBe(`${RAIL}.armor`);
		expect(armor.options).toEqual([
			{ value: 'none', label: 'NIMBLE.armorTypes.none' },
			{ value: 'medium', label: 'NIMBLE.armorTypes.medium' },
			{ value: 'heavy', label: 'NIMBLE.armorTypes.heavy' },
		]);
		expect(
			monsterRail(goblin({ system: { attributes: { armor: 'plate' } } }), monsterContext()).armor
				.value,
		).toBe('none');
	});

	it('gives the words of the Edit switch and of edit mode', () => {
		const rail = monsterRail(goblin(), monsterContext());

		expect(rail.edit).toEqual({
			label: `${RAIL}.edit`,
			startHint: `${RAIL}.editHint`,
			stopHint: `${RAIL}.stopEditing`,
		});
		expect(rail.text).toMatchObject({
			changePortrait: 'NIMBLE.prompts.changeActorImage',
			name: `${RAIL}.name`,
			noDefenses: `${RAIL}.noDefenses`,
		});
	});

	it('gives each configure outline its window, and none to a user who cannot change the monster', () => {
		const { configure } = monsterRail(goblin(), monsterContext());

		expect(configure).toEqual({
			metadata: {
				short: `${RAIL}.metaShort`,
				label: `${RAIL}.metaLabel`,
				intent: { kind: 'configure', target: 'metadata' },
			},
			saves: {
				short: `${RAIL}.savesShort`,
				label: 'NIMBLE.prompts.configureSavingThrows',
				intent: { kind: 'configure', target: 'saves' },
			},
			movement: {
				short: `${RAIL}.movementShort`,
				label: 'NIMBLE.prompts.configureMovement',
				intent: { kind: 'configure', target: 'movement' },
			},
			defenses: {
				short: `${RAIL}.defensesShort`,
				label: 'NIMBLE.npcSheet.editDamageDefenses',
				intent: { kind: 'configure', target: 'metadata' },
			},
		});
		expect(monsterRail(goblin(), monsterContext({ editable: false })).configure).toEqual({
			metadata: null,
			saves: null,
			movement: null,
			defenses: null,
		});
	});

	it('shows each speed that the monster has, and walking when it has none', () => {
		const statsOf = (movement: Record<string, number>) =>
			monsterRail(goblin({ system: { attributes: { movement } } }), monsterContext())
				.stats.slice(1)
				.map((stat) => [stat.id, stat.value]);

		expect(statsOf({ walk: 6 })).toEqual([['walk', 6]]);
		expect(statsOf({ walk: 0, burrow: 8 })).toEqual([['burrow', 8]]);
		expect(statsOf({ walk: 6, fly: 8 })).toEqual([
			['walk', 6],
			['fly', 8],
		]);
		expect(statsOf({ walk: 0 })).toEqual([['walk', 0]]);
	});

	it('lists only the defenses that the monster has, with the condition immunities, and VULNERABLE', () => {
		const rail = monsterRail(
			goblin({
				system: {
					attributes: { damageResistances: ['psychic'], damageVulnerabilities: ['fire', 'cold'] },
					conditionImmunities: ['frightened'],
				},
			}),
			monsterContext(),
		);

		expect(rail.defenses).toEqual([
			{ id: 'resist', label: `${RAIL}.defenses.resist`, value: 'Psychic' },
			{ id: 'immune', label: `${RAIL}.defenses.immune`, value: 'Frightened' },
			{ id: 'vulnerable', label: `${RAIL}.defenses.vulnerable`, value: 'Fire, Cold' },
		]);
		expect(monsterRail(goblin(), monsterContext()).defenses).toEqual([]);
	});

	it('moves and scales the portrait by the image settings', () => {
		const rail = monsterRail(
			goblin({ flags: { actorImageXOffset: 4, actorImageYOffset: -2, actorImageScale: 120 } }),
			monsterContext(),
		);

		expect(rail.portrait).toEqual({ x: 4, y: -2, scale: 120 });
	});
});

describe('monsterFrame', () => {
	it('has the four tabs, and counts the effects and conditions on the monster', () => {
		const frame = monsterFrame(effectsMonster(), effectsMonsterContext());

		expect(frame.tabs.map((tab) => tab.id)).toEqual(['abilities', 'effects', 'notes', 'settings']);
		expect(frame.tabs[1]).toMatchObject({ badge: 2 });
		expect(monsterFrame(goblin(), monsterContext()).tabs[1].badge).toBe(0);
	});

	it('gives the band of edit mode', () => {
		expect(monsterFrame(goblin(), monsterContext()).editBand).toEqual({
			title: 'NIMBLE.actorSheet.monster.frame.editing',
			hint: 'NIMBLE.actorSheet.monster.frame.editingHint',
			done: 'NIMBLE.actorSheet.monster.frame.done',
		});
	});
});
