import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const DIR = 'packs/monsterAbilities/core';

/** GM guide, Flavorful Monster Abilities, then the Legendary optional actions. */
const BOOK_ORDER = [
	'Acid Blood.',
	'Hates the Light.',
	'Hypnotic Gaze.',
	'Aggressive.',
	'Blinding Spit.',
	'Invulnerable.',
	'Mounted.',
	'Bloodthirsty.',
	'Obstinate.',
	'Brute.',
	'Pack Tactics.',
	'Brawler.',
	'Burning Aura.',
	'Parry.',
	'Ranged.',
	'Retaliate.',
	'Climbing.',
	'Controlling.',
	'Disgusting/Venomous/Heavy Blows.',
	'Savage.',
	'Shifty.',
	'Disintegrating Armor.',
	'Silencer.',
	'Doom.',
	'Explosive Death.',
	'Sneak.',
	'Spiked.',
	'FAST.',
	'Standard Bearer.',
	'Fearsome.',
	'Sturdy/Undying.',
	'Flying.',
	'Summoner.',
	'Formation.',
	'Tricky.',
	'Frenzied.',
	'Vicious.',
	'Warping Touch.',
	'Grappler.',
	'Webslinger.',
	'Gravity Manipulator.',
	'Wind Up/Breathe In.',
	'Terrible Roar/Creepy Monologue/Taunt.',
	'Toss Around/Telekinetic Shove.',
	'Size Up/Spot Weakness/Pin Down.',
];

const WITH_A_SHAPE = [
	'Hypnotic Gaze.',
	'Blinding Spit.',
	'Burning Aura.',
	'Disgusting/Venomous/Heavy Blows.',
	'Silencer.',
	'Doom.',
	'Sneak.',
	'Spiked.',
	'Fearsome.',
	'Grappler.',
	'Webslinger.',
	'Terrible Roar/Creepy Monologue/Taunt.',
	'Toss Around/Telekinetic Shove.',
	'Size Up/Spot Weakness/Pin Down.',
];

const ACTIONS = [
	'Hypnotic Gaze.',
	'Blinding Spit.',
	'Sneak.',
	'Fearsome.',
	'Webslinger.',
	'Wind Up/Breathe In.',
	'Terrible Roar/Creepy Monologue/Taunt.',
	'Toss Around/Telekinetic Shove.',
	'Size Up/Spot Weakness/Pin Down.',
];

const MOMENT_KEYS = [
	'kind',
	'boundary',
	'clock',
	'span',
	'value',
	'units',
	'who',
	'event',
	'effectName',
].sort();

const readDoc = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

const files = (): string[] => globSync(`${DIR}/*.json`).sort();

function abilities(): Json[] {
	return files().map(readDoc);
}

function ability(name: string): Json {
	const found = abilities().find((each) => each.name === name);
	if (!found) throw new Error(`No ability ${name}`);
	return found;
}

const steps = (item: Json): Json[] =>
	flattenEffectsTree(item.system?.activation?.effects ?? []) as Json[];

function onlyEffect(item: Json): Json {
	expect(item.effects).toHaveLength(1);
	const effect = item.effects[0] as Json;
	expect(effect.transfer).toBe(false);
	return effect;
}

function expectMoments(effect: Json, moments: unknown[]): void {
	expect(effect.system.lastsUntil).toEqual(moments);
	for (const moment of effect.system.lastsUntil as Json[]) {
		expect(Object.keys(moment).sort()).toEqual(MOMENT_KEYS);
	}
}

/** One save step at the root, with one Apply Effect step for the effect in its failed branch. */
function expectSaveThenApply(
	item: Json,
	saveType: string,
	effectId: string,
	recipient: string,
): void {
	const roots = item.system.activation.effects as Json[];
	expect(roots).toHaveLength(1);
	const save = roots[0] as Json;
	expect(save).toMatchObject({
		type: 'savingThrow',
		savingThrowType: saveType,
		saveDC: '',
		parentContext: null,
		parentNode: null,
	});
	expect(save.saveType).toBeUndefined();
	expect(save.on.failedSave).toEqual([
		expect.objectContaining({
			type: 'applyEffect',
			effectId,
			recipient,
			parentContext: 'failedSave',
			parentNode: save.id,
		}),
	]);
	expect(steps(item)).toHaveLength(2);
}

function expectRootApply(item: Json, effectId: string, recipient: string): void {
	expect(item.system.activation.effects).toEqual([
		expect.objectContaining({
			type: 'applyEffect',
			effectId,
			recipient,
			parentContext: null,
			parentNode: null,
		}),
	]);
}

const oneRound = expect.objectContaining({
	kind: 'time',
	value: 1,
	units: 'rounds',
	effectName: '',
});

describe('Monster Abilities pack', () => {
	it('holds the 45 abilities of the book, flat, and nothing else', () => {
		expect(BOOK_ORDER).toHaveLength(45);
		expect(new Set(BOOK_ORDER).size).toBe(45);
		expect(globSync(`${DIR}/**/*.json`).sort()).toEqual(files());
		const names = abilities().map((each) => each.name);
		expect([...names].sort()).toEqual([...BOOK_ORDER].sort());
	});

	it('makes every ability a Monster Feature with an id and the right subtype', () => {
		for (const item of abilities()) {
			expect(item.type, item.name).toBe('monsterFeature');
			expect(String(item._id), item.name).toMatch(/^[A-Za-z0-9]{16}$/);
			const subtype = ACTIONS.includes(item.name) ? 'action' : 'feature';
			expect(item.system.subtype, item.name).toBe(subtype);
			expect(item.system.description, item.name).toMatch(/^<p>.+<\/p>$/);
		}
	});

	it('keeps the abilities with no shape as text only', () => {
		for (const item of abilities()) {
			if (WITH_A_SHAPE.includes(item.name)) continue;
			expect(item.system.activation.effects, item.name).toEqual([]);
			expect(item.system.rules, item.name).toEqual([]);
			expect(item.effects, item.name).toEqual([]);
		}
	});

	it('keeps FAST. a text with no reaction cost', () => {
		expect(ability('FAST.').system.activation.cost).toMatchObject({
			type: 'none',
			isReaction: false,
		});
	});
});

describe('Hypnotic Gaze.', () => {
	it('Confuses the creatures that fail a WIL save for 1 round', () => {
		const item = ability('Hypnotic Gaze.');
		const effect = onlyEffect(item);
		expect(effect.statuses).toEqual(['confused']);
		expectMoments(effect, [oneRound]);
		expectSaveThenApply(item, 'will', effect._id, 'targets');
	});
});

describe('Blinding Spit.', () => {
	it('Blinds a creature that fails a DEX save for 1 round', () => {
		const item = ability('Blinding Spit.');
		const effect = onlyEffect(item);
		expect(effect.statuses).toEqual(['blinded']);
		expectMoments(effect, [oneRound]);
		expectSaveThenApply(item, 'dexterity', effect._id, 'targets');
		expect(item.system.activation.targets.count).toBe(1);
	});
});

describe('Burning Aura.', () => {
	it('burns each creature next to the monster for 1d6 fire at its turn start', () => {
		const item = ability('Burning Aura.');
		expect(item.effects).toEqual([]);
		expect(item.system.activation.effects).toEqual([]);
		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'turnDamage',
				at: 'turnStart',
				who: 'nearby',
				reach: 1,
				formula: '1d6',
				damageType: 'fire',
				wounds: 0,
			}),
		]);
	});
});

function expectHitAndCrit(item: Json, fields: Json): void {
	expect(item.system.rules).toEqual([
		expect.objectContaining({ type: 'applyCondition', trigger: 'onHit', ...fields }),
		expect.objectContaining({ type: 'applyCondition', trigger: 'onCrit', ...fields }),
	]);
	expect(item.system.activation.effects).toEqual([]);
}

describe('Disgusting/Venomous/Heavy Blows.', () => {
	it('Dazes the target on a hit or a crit, with the Dazed default end', () => {
		const item = ability('Disgusting/Venomous/Heavy Blows.');
		expectHitAndCrit(item, { condition: 'dazed', effectId: '' });
		expect(item.effects).toEqual([]);
	});
});

describe('Silencer.', () => {
	it('Silences the target on a hit or a crit, with no end', () => {
		const item = ability('Silencer.');
		expectHitAndCrit(item, { condition: 'silenced', effectId: '' });
		expect(item.effects).toEqual([]);
	});
});

describe('Doom.', () => {
	it('Wounds the target on a hit or a crit', () => {
		const item = ability('Doom.');
		expectHitAndCrit(item, { condition: '', effectId: '', wounds: 1 });
		expect(item.effects).toEqual([]);
	});
});

describe('Sneak.', () => {
	it('makes the monster Invisible until it attacks, on use', () => {
		const item = ability('Sneak.');
		const effect = onlyEffect(item);
		expect(effect.name).toBe('Invisible');
		expect(effect.statuses).toEqual(['invisible']);
		expectMoments(effect, [
			expect.objectContaining({ kind: 'event', who: 'holder', event: 'attack' }),
		]);
		expectRootApply(item, effect._id, 'self');
	});
});

describe('Spiked.', () => {
	it('deals 1d4 piercing back to each melee attacker that hits, ignoring armor', () => {
		const item = ability('Spiked.');
		expect(item.effects).toEqual([]);
		expect(item.system.rules).toEqual([
			expect.objectContaining({
				type: 'damageBack',
				trigger: 'damaged',
				onlyCrits: false,
				attackDelivery: 'melee',
				amount: 'formula',
				formula: '1d4',
				damageType: 'piercing',
				ignoreArmor: true,
			}),
		]);
	});
});

describe('Fearsome.', () => {
	it('Frightens the creatures that fail a WIL save, with no end', () => {
		const item = ability('Fearsome.');
		const effect = onlyEffect(item);
		expect(effect.statuses).toEqual(['frightened']);
		expectMoments(effect, []);
		expectSaveThenApply(item, 'will', effect._id, 'targets');
	});
});

describe('Grappler.', () => {
	it('Grapples the target on a hit or a crit, with an Escape that has no DC', () => {
		const item = ability('Grappler.');
		const effect = onlyEffect(item);
		expect(effect.name).toBe('Grappled');
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual({
			dc: '',
			saves: ['strength', 'dexterity'],
			noDc: true,
		});
		expectMoments(effect, []);
		expectHitAndCrit(item, { condition: 'grappled', effectId: effect._id });
	});
});

describe('Webslinger.', () => {
	it('Restrains the target with webs on the GM click, with an Escape that has no DC', () => {
		const item = ability('Webslinger.');
		const effect = onlyEffect(item);
		expect(effect.name).toBe('Webbed');
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.escape).toEqual({
			dc: '',
			saves: ['strength', 'dexterity'],
			noDc: true,
		});
		expectMoments(effect, []);
		expectRootApply(item, effect._id, 'targets');
	});
});

describe('Terrible Roar/Creepy Monologue/Taunt.', () => {
	it('Frightens the creatures that fail a WIL save for 1 turn', () => {
		const item = ability('Terrible Roar/Creepy Monologue/Taunt.');
		const effect = onlyEffect(item);
		expect(effect.statuses).toEqual(['frightened']);
		expectMoments(effect, [
			expect.objectContaining({
				kind: 'turn',
				boundary: 'end',
				clock: 'holder',
				span: 'nextTurn',
			}),
		]);
		expectSaveThenApply(item, 'will', effect._id, 'targets');
	});
});

describe('Toss Around/Telekinetic Shove.', () => {
	it('knocks Prone the creatures that fail a STR save', () => {
		const item = ability('Toss Around/Telekinetic Shove.');
		const effect = onlyEffect(item);
		expect(effect.statuses).toEqual(['prone']);
		expectMoments(effect, []);
		expectSaveThenApply(item, 'strength', effect._id, 'targets');
	});
});

describe('Size Up/Spot Weakness/Pin Down.', () => {
	it('gives the monster advantage on its next attack when the target fails a DEX save', () => {
		const item = ability('Size Up/Spot Weakness/Pin Down.');
		const effect = onlyEffect(item);
		expect(effect.name).toBe('Sized Up');
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toContain('Your next attack cannot be Interposed.');
		expect(effect.system.rules).toEqual([
			expect.objectContaining({
				type: 'heldRoll',
				heldKind: 'advantage',
				value: 1,
				whichRoll: 'holderAttacks',
				usedUp: true,
			}),
		]);
		expectMoments(effect, [
			expect.objectContaining({ kind: 'event', who: null, event: 'combatEnd', value: null }),
		]);
		expectSaveThenApply(item, 'dexterity', effect._id, 'self');
		expect(steps(item).find((node) => node.type === 'applyEffect')?.waitsForClick).toBeUndefined();
	});
});
