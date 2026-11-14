import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import {
	allSteps,
	combatEnds,
	effectEnds,
	effectNamed,
	expectLastsUntil,
	hours,
	type Json,
	looseMoment,
	minutes,
	NO_DC_ESCAPE,
	onEvent,
	readItem,
	rootSteps,
	rounds,
} from '../../../tests/fixtures/packContent.js';

const DIR = 'packs/hazards/core';

const HAZARDS = [
	'Rootbreaker Pit.',
	'Fetid Stench.',
	'Rat Bite.',
	'Explosive Tunnels Gas.',
	'Pill Bugs.',
	"Adventurer's Bane.",
	'Sleepy Oasis.',
	'Sand Madness.',
	'Glacial River.',
	'Spear of Lightning.',
	'Thorn Briars.',
	'Fetid Gas.',
	'Cauldron.',
	'Poison Vent.',
	'A Sleepy Trick.',
];

const files = (): string[] => globSync(`${DIR}/*.json`).sort();

const hazards = (): Json[] => files().map(readItem);

function hazard(name: string): Json {
	const found = hazards().find((each) => each.name === name);
	if (!found) throw new Error(`No hazard ${name}`);
	return found;
}

function rootSave(item: Json, saveType: string, dc: string): Json {
	const save = rootSteps(item).find((node) => node.type === 'savingThrow');
	if (!save) throw new Error(`${item.name} has no save step`);
	expect(save).toMatchObject({
		savingThrowType: saveType,
		saveDC: dc,
		parentContext: null,
		parentNode: null,
	});
	expect(save.saveType).toBeUndefined();
	return save;
}

const applies = (effectId: string, parentContext: string | null, parentNode: string | null) =>
	expect.objectContaining({
		type: 'applyEffect',
		effectId,
		recipient: 'targets',
		parentContext,
		parentNode,
	});

const atRoot = (effectId: string) => applies(effectId, null, null);

function expectFailApplies(save: Json, effectIds: string[]): void {
	const applied = (save.on.failedSave as Json[]).filter((node) => node.type === 'applyEffect');
	expect(applied).toEqual(effectIds.map((id) => applies(id, 'failedSave', save.id)));
}

function expectUntypedDamage(item: Json, formula: string): void {
	const damage = rootSteps(item).find((node) => node.type === 'damage');
	expect(damage).toMatchObject({ formula, damageType: '', parentContext: null, parentNode: null });
	expect(damage?.on.hit).toEqual([
		expect.objectContaining({ type: 'damageOutcome', outcome: 'fullDamage' }),
	]);
}

const turnDamage = (fields: Json) =>
	expect.objectContaining({ type: 'turnDamage', at: 'turnStart', who: 'holder', ...fields });
const speedMinusOne = expect.objectContaining({ type: 'speedBonus', value: '-1' });

describe('Hazards pack', () => {
	it('holds the 15 hazards, flat, and nothing else', () => {
		expect(new Set(HAZARDS).size).toBe(15);
		expect(globSync(`${DIR}/**/*.json`).sort()).toEqual(files());
		expect(
			hazards()
				.map((each) => each.name)
				.sort(),
		).toEqual([...HAZARDS].sort());
	});

	it('makes every hazard a Monster Feature action with an id and a book text', () => {
		for (const item of hazards()) {
			expect(item.type, item.name).toBe('monsterFeature');
			expect(item.system.subtype, item.name).toBe('action');
			expect(String(item._id), item.name).toMatch(/^[A-Za-z0-9]{16}$/);
			expect(item.system.description, item.name).toMatch(/^<p>.+<\/p>$/);
			for (const effect of item.effects as Json[]) expect(effect.transfer).toBe(false);
		}
	});
});

describe('Rootbreaker Pit.', () => {
	it('Grapples a creature that fails a DC 10 DEX save, with an Escape that has no DC', () => {
		const item = hazard('Rootbreaker Pit.');
		const grappled = effectNamed(item, 'Grappled');
		expect(grappled.transfer).toBe(false);
		expect(grappled.statuses).toEqual(['grappled']);
		expect(grappled.system.escape).toEqual(NO_DC_ESCAPE);
		expectLastsUntil(grappled, []);
		expectFailApplies(rootSave(item, 'dexterity', '10'), [grappled._id]);
		expect(allSteps(item)).toHaveLength(2);
	});
});

describe('Fetid Stench.', () => {
	it('Poisons a creature that fails a STR save, with the six DCs in the text', () => {
		const item = hazard('Fetid Stench.');
		const poisoned = effectNamed(item, 'Fetid Stench');
		expect(poisoned.transfer).toBe(false);
		expect(poisoned.statuses).toEqual(['poisoned']);
		expectLastsUntil(poisoned, []);
		expectFailApplies(rootSave(item, 'strength', ''), [poisoned._id]);
		for (const dc of ['6', '8', '10', '12', '14', '16']) {
			expect(item.system.description).toContain(`DC ${dc}`);
		}
	});
});

describe('Rat Bite.', () => {
	it('deals 1 damage and Poisons on a failed DC 10 STR save until the hero heals', () => {
		const item = hazard('Rat Bite.');
		expectUntypedDamage(item, '1');
		const poisoned = effectNamed(item, 'Rat Bite');
		expect(poisoned.transfer).toBe(false);
		expect(poisoned.statuses).toEqual(['poisoned']);
		expectLastsUntil(poisoned, [looseMoment(onEvent('holder', 'healed'), 'effectName')]);
		expectFailApplies(rootSave(item, 'strength', '10'), [poisoned._id]);
	});
});

describe('Explosive Tunnels Gas.', () => {
	it('has a step for each result: Dizzy, Fumesick and its Wound, with no save step', () => {
		const item = hazard('Explosive Tunnels Gas.');
		const dizzy = effectNamed(item, 'Dizzy');
		expect(dizzy.transfer).toBe(false);
		const fumesick = effectNamed(item, 'Fumesick');
		expect(fumesick.transfer).toBe(false);
		expect(dizzy.statuses).toEqual([]);
		expect(dizzy.system.rules).toEqual([speedMinusOne]);
		expectLastsUntil(dizzy, []);
		expect(fumesick.statuses).toEqual(['poisoned']);
		expect(fumesick.system.rules).toEqual([speedMinusOne]);
		expectLastsUntil(fumesick, []);
		expect(rootSteps(item)).toEqual([
			atRoot(dizzy._id),
			atRoot(fumesick._id),
			expect.objectContaining({ type: 'wound', amount: 1, recipient: 'targets' }),
		]);
		expect(allSteps(item).some((node) => node.type === 'savingThrow')).toBe(false);
	});
});

describe('Pill Bugs.', () => {
	it('Grapples and Smothers a creature that fails a DC 12 DEX save: 1 Wound each turn until it escapes', () => {
		const item = hazard('Pill Bugs.');
		const grappled = effectNamed(item, 'Grappled');
		expect(grappled.transfer).toBe(false);
		const smothered = effectNamed(item, 'Smothered');
		expect(smothered.transfer).toBe(false);
		expect(grappled.statuses).toEqual(['grappled']);
		expect(grappled.system.escape).toEqual(NO_DC_ESCAPE);
		expectLastsUntil(grappled, []);
		expect(smothered.statuses).toEqual(['blinded']);
		expect(smothered.system.rules).toEqual([turnDamage({ formula: '', wounds: 1 })]);
		expectLastsUntil(smothered, [looseMoment(effectEnds('Grappled'), 'effectName')]);
		expectFailApplies(rootSave(item, 'dexterity', '12'), [grappled._id, smothered._id]);
	});
});

describe("Adventurer's Bane.", () => {
	it('marks the creature that eats it for 1 round', () => {
		const item = hazard("Adventurer's Bane.");
		const bane = effectNamed(item, "Adventurer's Bane");
		expect(bane.transfer).toBe(false);
		expect(bane.statuses).toEqual([]);
		expect(bane.description).toContain('Sees allies as enemies.');
		expectLastsUntil(bane, [looseMoment(rounds(1), 'effectName')]);
		expect(rootSteps(item)).toEqual([atRoot(bane._id)]);
	});
});

describe('Sleepy Oasis.', () => {
	it('puts the drinker to sleep for an hour and gives 1 Wound', () => {
		const item = hazard('Sleepy Oasis.');
		const sleep = effectNamed(item, 'Oasis Sleep');
		expect(sleep.transfer).toBe(false);
		expect(sleep.statuses).toEqual(['unconscious']);
		expectLastsUntil(sleep, [looseMoment(hours(1), 'effectName')]);
		expect(rootSteps(item)).toEqual([
			atRoot(sleep._id),
			expect.objectContaining({ type: 'wound', amount: 1, recipient: 'targets' }),
		]);
	});
});

describe('Sand Madness.', () => {
	it('gives disadvantage on attacks on a failed WIL save, for 3 hours or until the next encounter ends', () => {
		const item = hazard('Sand Madness.');
		const madness = effectNamed(item, 'Sand Madness');
		expect(madness.transfer).toBe(false);
		expect(madness.statuses).toEqual([]);
		expect(madness.description).toContain('You cannot take reactions.');
		expect(madness.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'advantage',
				value: -1,
				whichRoll: 'holderAttacks',
				usedUp: false,
			}),
		]);
		expectLastsUntil(madness, [
			looseMoment(hours(3), 'effectName'),
			looseMoment(combatEnds(null), 'value'),
		]);
		expectFailApplies(rootSave(item, 'will', ''), [madness._id]);
	});
});

describe('Glacial River.', () => {
	it('gives -1 speed until removed', () => {
		const item = hazard('Glacial River.');
		const soaked = effectNamed(item, 'Soaked');
		expect(soaked.transfer).toBe(false);
		expect(soaked.system.rules).toEqual([speedMinusOne]);
		expectLastsUntil(soaked, []);
		expect(rootSteps(item)).toEqual([atRoot(soaked._id)]);
	});
});

describe('Spear of Lightning.', () => {
	it('gives Charged and +1d6 lightning damage for 1 minute', () => {
		const item = hazard('Spear of Lightning.');
		const charged = effectNamed(item, 'Charged');
		expect(charged.transfer).toBe(false);
		const spear = effectNamed(item, 'Spear of Lightning');
		expect(spear.transfer).toBe(false);
		expect(charged.statuses).toEqual(['charged']);
		expectLastsUntil(charged, [looseMoment(minutes(1), 'effectName')]);
		expect(spear.statuses).toEqual([]);
		expect(spear.system.rules).toEqual([
			expect.objectContaining({
				type: 'damageBonus',
				value: '1d6',
				damageType: 'lightning',
				delivery: 'any',
				source: 'any',
			}),
		]);
		expectLastsUntil(spear, [looseMoment(minutes(1), 'effectName')]);
		expect(rootSteps(item)).toEqual([atRoot(charged._id), atRoot(spear._id)]);
	});
});

describe('Thorn Briars.', () => {
	it('deals 1d4 and drains 1d4 each turn until a Finesse check removes the thorn or the hero heals', () => {
		const item = hazard('Thorn Briars.');
		expectUntypedDamage(item, '1d4');
		const thorn = effectNamed(item, 'Draining Thorn');
		expect(thorn.transfer).toBe(false);
		expect(thorn.system.escape).toEqual({ dc: '', saves: [], noDc: true, skills: ['finesse'] });
		expect(thorn.system.rules).toEqual([turnDamage({ formula: '1d4', damageType: '', wounds: 0 })]);
		expectLastsUntil(thorn, [looseMoment(onEvent('holder', 'healed'), 'effectName')]);
		expect(rootSteps(item)).toContainEqual(atRoot(thorn._id));
	});
});

describe('Fetid Gas.', () => {
	it('Poisons a creature that fails a STR save for 2 encounters', () => {
		const item = hazard('Fetid Gas.');
		const gas = effectNamed(item, 'Fetid Gas');
		expect(gas.transfer).toBe(false);
		expect(gas.statuses).toEqual(['poisoned']);
		expectLastsUntil(gas, [looseMoment(combatEnds(2), 'value')]);
		expectFailApplies(rootSave(item, 'strength', ''), [gas._id]);
	});
});

describe('Cauldron.', () => {
	it('deals 1d20 fire at each turn start to a creature pushed in on a failed DC 10 DEX save, until it moves', () => {
		const item = hazard('Cauldron.');
		const cauldron = effectNamed(item, 'In the Cauldron');
		expect(cauldron.transfer).toBe(false);
		expect(cauldron.system.rules).toEqual([
			turnDamage({ formula: '1d20', damageType: 'fire', wounds: 0 }),
		]);
		expectLastsUntil(cauldron, [looseMoment(onEvent('holder', 'move'), 'effectName')]);
		expectFailApplies(rootSave(item, 'dexterity', '10'), [cauldron._id]);
		expect(allSteps(item).some((node) => node.type === 'damage')).toBe(false);
	});
});

describe('Poison Vent.', () => {
	it('Poisons a creature that fails a STR save for 2 encounters, with a note for the damage', () => {
		const item = hazard('Poison Vent.');
		const vent = effectNamed(item, 'Poison Vent');
		expect(vent.transfer).toBe(false);
		expect(vent.statuses).toEqual(['poisoned']);
		expectLastsUntil(vent, [looseMoment(combatEnds(2), 'value')]);
		const save = rootSave(item, 'strength', '');
		expectFailApplies(save, [vent._id]);
		expect(save.on.failedSave).toContainEqual(
			expect.objectContaining({ type: 'note', text: 'Take half your level in poison damage.' }),
		);
	});
});

describe('A Sleepy Trick.', () => {
	it('puts a creature that fails an INT save to sleep, with no end', () => {
		const item = hazard('A Sleepy Trick.');
		const asleep = effectNamed(item, 'Asleep');
		expect(asleep.transfer).toBe(false);
		expect(asleep.statuses).toEqual(['unconscious']);
		expectLastsUntil(asleep, []);
		expectFailApplies(rootSave(item, 'intelligence', ''), [asleep._id]);
	});
});
