import { describe, expect, it } from 'vitest';
import {
	actorItem,
	allSteps,
	effectById,
	effectNamed,
	endOfHoldersNextTurn,
	endOfNextHerosTurn,
	endOfRound,
	escapeDc,
	exactMoment,
	expectAtRoot,
	expectNineKeys,
	GRAPPLED_IMG,
	grappleEnds,
	holderTakesDamage,
	type Json,
	NO_DC_ESCAPE,
	onEvent,
	rawStepById,
	readActor,
	readItem,
	rounds,
	sourceGains,
	stepApplying,
	stepById,
	stepsApplying,
} from '../../../../tests/fixtures/packContent.js';
import { deliveryOfAttack } from '../../../utils/damage/attackDelivery.js';

const L = 'packs/legendaryMonsters/core';
const FILES = {
	thorn: `${L}/thorn-quickblade.json`,
	dravok: `${L}/dravok-all-seeing-tyrant.json`,
	poppy: `${L}/poppy-giant-stinkbug.json`,
	grimbeak: `${L}/grimbeak-the-unyielding.json`,
	aranya: `${L}/queen-aranya-broodmother.json`,
	florindris: `${L}/florindris-bane-of-the-forest.json`,
	lindWorm: `${L}/lind-worm.json`,
	azriel: `${L}/azriel-lord-of-pain-and-flame.json`,
	krogg: `${L}/krogg-goblin-king.json`,
	greenthumb: `${L}/greenthumb-lichling.json`,
	scorpionQueen: `${L}/scorpion-queen.json`,
	ulvek: `${L}/ulvek-psionic-despot.json`,
	titan: `${L}/titan-of-the-deep-woods.json`,
	pudge: `${L}/pudge-the-blunderer.json`,
	nalzar: `${L}/nalzar-apex-predator.json`,
	manglemaul: 'packs/magicItems/core/gmGuide/manglemaul.json',
	resoluteFangs: 'packs/magicItems/core/coreRules/resolute-fangs-golden-bastion.json',
};

function expectUnder(item: Json, step: Json, parentId: string, context: string): void {
	expect(step.parentNode).toBe(parentId);
	expect(step.parentContext).toBe(context);
	const parent = rawStepById(item, parentId) as Json;
	expect((parent.on[context] as Json[]).map((node) => node.id)).toContain(step.id);
}

function expectNewId(id: string): void {
	expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
}

function expectNoHampered(item: Json, nodeId: string, effectId: string): void {
	expect(stepById(item, nodeId)).toBeUndefined();
	expect((item.effects as Json[]).some((each) => each._id === effectId)).toBe(false);
	expect((item.effects as Json[]).some((each) => each.statuses.includes('hampered'))).toBe(false);
}

describe('Thorn Quickblade :: Bloodied', () => {
	const item = actorItem(FILES.thorn, 'Bloodied');
	const effect = effectNamed(item, 'Invisible');

	it('Invisible lasts until the end of his next turn', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual(['invisible']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfHoldersNextTurn)]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to Thorn himself at the root', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Thorn Quickblade :: Heart Piercer (Rapier).', () => {
	const item = actorItem(FILES.thorn, 'Heart Piercer (Rapier).');

	it('has no Hampered step or effect', () => {
		expectNoHampered(item, 'MpDaOq8uDvrZ2wMS', 'Fcdh94q0vsFgapW4');
	});

	it('keeps Dazed on a crit', () => {
		const step = stepApplying(item, 'z4atxdvP9jXYNcl6');
		expectUnder(item, step, 'Vmm3IICgQYD0xGC3', 'criticalHit');
	});
});

describe('Dravok :: Weakness', () => {
	const item = actorItem(FILES.dravok, 'Weakness');
	const effect = effectNamed(item, 'FLAWED');

	it('FLAWED is a marker until the end of the next hero turn', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe(
			"Dravok's plans are FLAWED: My plans, flawless! does not apply.",
		);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfNextHerosTurn)]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to Dravok himself at the root', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Dravok :: 2. Petrification Ray', () => {
	const item = actorItem(FILES.dravok, '2. Petrification Ray');
	const dazed = effectNamed(item, 'Dazed');
	const petrified = effectNamed(item, 'Petrified');

	it('Dazed lasts until healed and stacks to Petrified at 3', () => {
		expectNewId(dazed._id);
		expect(dazed.transfer).toBe(false);
		expect(dazed.statuses).toEqual(['dazed']);
		expect(dazed.system.lastsUntil).toEqual([exactMoment(onEvent('holder', 'healed'))]);
		expectNineKeys(dazed, ['damageTypes']);
		expect(dazed.system.stacks).toEqual({ on: true, count: 1, at: 3, effectId: petrified._id });
	});

	it('Petrified has no moments and no step', () => {
		expectNewId(petrified._id);
		expect(petrified.transfer).toBe(false);
		expect(petrified.statuses).toEqual(['petrified']);
		expect(petrified.system.lastsUntil).toEqual([]);
		expect(stepsApplying(item, petrified._id)).toEqual([]);
	});

	it('applies Dazed to the targets at the root', () => {
		const step = stepApplying(item, dazed._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('targets');
		expectAtRoot(item, step);
	});
});

describe('Dravok :: 3. Terror Ray', () => {
	const item = actorItem(FILES.dravok, '3. Terror Ray');
	const weakness = actorItem(FILES.dravok, 'Weakness');
	const effect = effectNamed(item, 'Terrified');

	it('Terrified is Frightened until Dravok gains FLAWED', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual(['frightened']);
		expect(effect.description).toBe(
			'Cannot spend resources; spent actions come back afterward. Your screams give allies within 6 spaces disadvantage on rolls.',
		);
		expect(effect.system.lastsUntil).toEqual([exactMoment(sourceGains('FLAWED'))]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('the gained name is the Weakness marker name', () => {
		const flawed = effectNamed(weakness, 'FLAWED');
		expect(effect.system.lastsUntil[0].effectName).toBe(flawed.name);
	});

	it('applies to the targets on a hit, and the old note is gone', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'hp79M6PwhC6h3dXu', 'hit');
		expect(stepById(item, '5qyte95rBYaomW24')).toBeUndefined();
	});
});

describe('Poppy, Giant Stinkbug :: Stink Cloud.', () => {
	const item = actorItem(FILES.poppy, 'Stink Cloud.');
	const effect = effectNamed(item, 'Stink Cloud');
	const saves = allSteps(item).filter((node) => node.type === 'savingThrow');

	it('asks a STR save at the higher of 10 or the damage', () => {
		expect(saves).toHaveLength(1);
		const save = saves[0] as Json;
		expectNewId(save.id);
		expect(save.savingThrowType).toBe('strength');
		expect(save.saveType).toBeUndefined();
		expect(save.saveDC).toBe('max(10, @damageTaken)');
		expectAtRoot(item, save);
	});

	it('targets the creatures within 2 spaces with a 2-space emanation that is not an attack', () => {
		const { activation } = item.system;
		expect(activation.acquireTargetsFromTemplate).toBe(true);
		expect(activation.template).toEqual({ length: 1, radius: 2, shape: 'emanation', width: 1 });
		expect(activation.targets).toEqual({ count: 1, restrictions: '' });
		expect(deliveryOfAttack(activation, { type: 'soloMonster' })).toBeNull();
	});

	it('Stink Cloud is a marker until the end of the round', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe(
			'Cannot take reactions this round. Must spend the next action vomiting.',
		);
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfRound)]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to the targets on a failed save', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, (saves[0] as Json).id, 'failedSave');
	});
});

describe('Grimbeak :: Savage Screech. (1 use)', () => {
	const item = actorItem(FILES.grimbeak, 'Savage Screech. (1 use)');
	const effect = effectById(item, 'DsGt2DpGYGbJGBRU');

	it('the save is WIL', () => {
		const save = stepById(item, 'xZIueLkPzG1imQG4') as Json;
		expect(save.savingThrowType).toBe('will');
		expect(save.saveType).toBeUndefined();
	});

	it('Frightened lasts 1 round', () => {
		expect(effect.statuses).toEqual(['frightened']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(rounds(1))]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies on a failed save', () => {
		expectUnder(item, stepApplying(item, effect._id), 'xZIueLkPzG1imQG4', 'failedSave');
	});
});

describe('Queen Aranya :: Weave Web.', () => {
	const item = actorItem(FILES.aranya, 'Weave Web.');
	const effect = effectNamed(item, 'Weave Web suppressed');

	it('the marker lasts until the end of her next turn', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Fire critical hits suppress Weave Web.');
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfHoldersNextTurn)]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to herself at the root', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Florindris :: Wither', () => {
	const item = actorItem(FILES.florindris, 'Wither');
	const effect = effectNamed(item, 'Aura of Wind suppressed');

	it('the marker lasts until the end of her next turn', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.statuses).toEqual([]);
		expect(effect.description).toBe('Necrotic damage suppresses Aura of Wind.');
		expect(effect.system.lastsUntil).toEqual([exactMoment(endOfHoldersNextTurn)]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies to herself at the root', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('self');
		expectAtRoot(item, step);
	});
});

describe('Lind Worm :: Squeeze & Spit Acid.', () => {
	const item = actorItem(FILES.lindWorm, 'Squeeze & Spit Acid.');
	const effect = effectById(item, 'pj4cTepYoSYKpGoc');

	it('Poisoned lasts until healed', () => {
		expect(effect.statuses).toEqual(['poisoned']);
		expect(effect.system.lastsUntil).toEqual([exactMoment(onEvent('holder', 'healed'))]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies on a crit', () => {
		expectUnder(item, stepApplying(item, effect._id), 'lindAcidDmgMain1', 'criticalHit');
	});
});

describe('Lind Worm :: Constrict.', () => {
	const item = actorItem(FILES.lindWorm, 'Constrict.');
	const effect = effectById(item, 'wrlFUYz5svckZmys');

	it('Grappled has escape DC 10', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies on a hit', () => {
		expectUnder(item, stepApplying(item, effect._id), 'lindConstrictDmg1', 'hit');
	});
});

describe('Azriel :: Crackling Whip.', () => {
	const item = actorItem(FILES.azriel, 'Crackling Whip.');
	const effect = effectById(item, 'xv8Fc5vWRAQjUAMY');

	it('Grappled has escape DC 17 and ends when Azriel uses the whip again', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('17'));
		expect(effect.system.lastsUntil).toEqual([
			...grappleEnds.map(exactMoment),
			exactMoment(onEvent('source', 'useAgain')),
		]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies on a hit', () => {
		expectUnder(item, stepApplying(item, effect._id), 'WTN0fnMszWjCsCmH', 'hit');
	});

	it('has no Hampered step or effect', () => {
		expectNoHampered(item, '6MsROoUtyiRYSHAH', 'zlWRyqIOi1s22NnM');
	});
});

describe('Krogg :: Manglemaul.', () => {
	const item = actorItem(FILES.krogg, 'Manglemaul.');
	const effect = effectById(item, 'h09xV9czQV1OGNXM');

	it('Grappled has escape DC 10', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies on a hit', () => {
		expectUnder(item, stepApplying(item, effect._id), 'kroggMangleDmg1', 'hit');
	});
});

describe('Greenthumb :: Root.', () => {
	const item = actorItem(FILES.greenthumb, 'Root.');
	const effect = effectById(item, 'fOFSCnZsv5MVN9Mr');

	it('the save is DEX', () => {
		const save = stepById(item, 'greenRootSave001') as Json;
		expect(save.savingThrowType).toBe('dexterity');
		expect(save.saveType).toBeUndefined();
	});

	it('Restrained has escape DC 11 and ends on slashing or fire damage', () => {
		expect(effect.statuses).toEqual(['restrained']);
		expect(effect.system.escape).toEqual(escapeDc('11'));
		expect(effect.system.lastsUntil).toEqual([exactMoment(holderTakesDamage('slashing', 'fire'))]);
		expectNineKeys(effect, ['damageTypes']);
	});

	it('applies on a failed save', () => {
		expectUnder(item, stepApplying(item, effect._id), 'greenRootSave001', 'failedSave');
	});
});

describe('Scorpion Queen :: Claw.', () => {
	const item = actorItem(FILES.scorpionQueen, 'Claw.');
	const effect = effectById(item, 'vf8tj09dLfsPplWC');

	it('Grappled has escape DC 12', () => {
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('12'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies on a hit', () => {
		expectUnder(item, stepApplying(item, effect._id), 'scorpClawDamage01', 'hit');
	});
});

describe('Ulvek :: Consume.', () => {
	const item = actorItem(FILES.ulvek, 'Consume.');
	const effect = effectNamed(item, 'Grappled');

	it('Grappled has an escape with no DC', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(GRAPPLED_IMG);
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(NO_DC_ESCAPE);
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a hit', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'zJ04oIjTSeF6cw0b', 'hit');
	});
});

describe('Hampered steps removed from legendary monsters', () => {
	it('Titan :: Crushing Stomp.', () => {
		const item = actorItem(FILES.titan, 'Crushing Stomp.');
		expectNoHampered(item, 'yFwlQsb7CX6sTfrG', 'apkxpj9tj87zsOSM');
		expectUnder(item, stepApplying(item, 'zPgnX5v3WagTMMth'), 'jzrLfKyxPi7ujvTJ', 'hit');
	});

	it('Pudge :: Move & Smack.', () => {
		const item = actorItem(FILES.pudge, 'Move & Smack.');
		expectNoHampered(item, '58PWXSKjDsRMohWr', 'Fn9JoExpzFFZmQkc');
		expectUnder(item, stepApplying(item, 'PT1M1r4VlGV4K7T8'), 'fpYTjiKcPYII10tZ', 'hit');
	});

	it('Nalzar :: Tail Swipe.', () => {
		const item = actorItem(FILES.nalzar, 'Tail Swipe.');
		expectNoHampered(item, '7Xvl3e22HkkWcTGi', 'CjJd3Ft3JDj1h6UJ');
		expectAtRoot(item, stepApplying(item, '9rRHeEWnuaYAQ4B5'));
	});

	it('Nalzar :: Wing Buffet.', () => {
		const item = actorItem(FILES.nalzar, 'Wing Buffet.');
		expectNoHampered(item, 'LwJ8iS6H76SUg9YT', 'wiSSsa3KBuGd8TkW');
		const save = stepById(item, 'XSsMqXrm3eke0Gj6') as Json;
		expect(save.savingThrowType).toBe('strength');
		expect(save).not.toHaveProperty('saveType');
		expectUnder(item, stepApplying(item, 'UzjyEJKtYZ2z8AB6'), 'XSsMqXrm3eke0Gj6', 'failedSave');
	});

	it('no legendary monster item has a Hampered effect', () => {
		for (const file of Object.values(FILES).filter((each) => each.startsWith(L))) {
			for (const item of readActor(file).items as Json[]) {
				for (const effect of (item.effects ?? []) as Json[]) {
					expect(effect.statuses, `${file} ${item.name}`).not.toContain('hampered');
				}
			}
		}
	});
});

describe('Manglemaul (magic item)', () => {
	const item = readItem(FILES.manglemaul);
	const effect = effectNamed(item, 'Grappled');

	it('Grappled has escape DC 10', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(GRAPPLED_IMG);
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual(escapeDc('10'));
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('applies to the targets on a hit', () => {
		const step = stepApplying(item, effect._id);
		expectNewId(step.id);
		expect(step.recipient).toBe('targets');
		expectUnder(item, step, 'ManglemaulDmg', 'hit');
	});
});

describe('Resolute Fangs, Golden Bastion', () => {
	const item = readItem(FILES.resoluteFangs);
	const effect = effectNamed(item, 'Grappled');

	it('Grappled has escape DC 20 STR', () => {
		expectNewId(effect._id);
		expect(effect.transfer).toBe(false);
		expect(effect.img).toBe(GRAPPLED_IMG);
		expect(effect.statuses).toEqual(['grappled']);
		expect(effect.system.escape).toEqual({ dc: '20', saves: ['strength'] });
		expect(effect.system.lastsUntil).toEqual([]);
	});

	it('is a Defend window tick against a melee attack that gives the attacker Grappled', () => {
		expect((item.system.rules as Json[]).map((rule) => rule.type)).toEqual([
			'armorClass',
			'defendOption',
		]);
		const [rule] = (item.system.rules as Json[]).filter((each) => each.type === 'defendOption');
		expectNewId(rule.id);
		expect(rule).toMatchObject({
			disabled: false,
			way: 'withDefend',
			attackDelivery: 'melee',
			outcome: 'none',
			armorBonus: '',
			useReroll: false,
			alsoInterpose: false,
			attackerEffectId: effect._id,
			reminder: '',
			useItem: false,
			withInterpose: false,
			wholeRound: false,
			chargePoolIdentifier: '',
			actionCost: 0,
			manaCost: 0,
			woundCost: 0,
		});
	});

	it('has no step that applies Grappled: the Defend tick does', () => {
		expect(stepsApplying(item, effect._id)).toEqual([]);
	});
});
