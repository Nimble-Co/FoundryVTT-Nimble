import { describe, expect, it } from 'vitest';
import {
	blankHero,
	heroContext,
	heroItem,
	heroTurn,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroRail } from '../heroRail.ts';

const RAIL = 'NIMBLE.actorSheet.hero.rail';

describe('heroRail', () => {
	describe('Inspiration', () => {
		it('shows the seal on, and a click ends it', () => {
			const view = heroRail(
				blankHero({ system: { resources: { inspiration: true } } }),
				heroContext(),
			);

			expect(view.inspiration).toEqual({
				on: true,
				label: `${RAIL}.inspiration.label`,
				tooltip: `${RAIL}.inspiration.on`,
				intent: { kind: 'setInspiration', value: false },
			});
		});

		it('shows the seal off, and a click gives it', () => {
			const view = heroRail(
				blankHero({ system: { resources: { inspiration: false } } }),
				heroContext(),
			);

			expect(view.inspiration).toEqual({
				on: false,
				label: `${RAIL}.inspiration.label`,
				tooltip: `${RAIL}.inspiration.off`,
				intent: { kind: 'setInspiration', value: true },
			});
		});
	});

	describe('who the hero is', () => {
		it('names the ancestry, size, class and level', () => {
			const view = heroRail(blankHero(), heroContext());

			expect(view.name).toBe('Blank Hero');
			expect(view.meta).toBe(
				`${RAIL}.metaAncestry {"ancestry":"Human","size":"NIMBLE.sizeCategories.medium"} | ` +
					`${RAIL}.metaClass {"class":"Berserker","level":"1"}`,
			);
		});

		it('adds the subclass to the class', () => {
			const hero = blankHero();
			hero.items.push(heroItem({ type: 'subclass', name: 'Path of the Red Mist' }));
			const view = heroRail(hero, heroContext());

			expect(view.meta).toContain(
				`${RAIL}.metaSubclass {"class":"Berserker","subclass":"Path of the Red Mist","level":"1"}`,
			);
		});

		it('moves and scales the portrait by the image settings', () => {
			expect(heroRail(blankHero(), heroContext()).portrait).toEqual({ x: 0, y: 0, scale: 100 });

			const hero = blankHero({
				flags: { actorImageXOffset: -12, actorImageYOffset: 30, actorImageScale: 150 },
			});
			expect(heroRail(hero, heroContext()).portrait).toEqual({ x: -12, y: 30, scale: 150 });
		});
	});

	describe('hit points', () => {
		it('says Bloodied at half HP or less, and Dying at 0', () => {
			const hp = (value: number) =>
				heroRail(blankHero({ system: { attributes: { hp: { value } } } }), heroContext()).hp;

			expect(hp(11).state).toBeNull();
			expect(hp(10).state).toBe('NIMBLE.conditions.bloodied');
			expect(hp(0)).toMatchObject({ state: 'NIMBLE.conditions.dying', dying: true });
		});
	});

	describe('meters', () => {
		it('gives wounds as toggle segments: a click on a filled segment lowers the count', () => {
			const hero = blankHero({ system: { attributes: { wounds: { value: 2, max: 6 } } } });
			const wounds = heroRail(hero, heroContext()).meters.find((m) => m.kind === 'wounds');

			expect(wounds?.kind === 'wounds' && wounds.segments.map((s) => s.on)).toEqual([
				true,
				true,
				false,
				false,
				false,
				false,
			]);
			if (wounds?.kind !== 'wounds') throw new Error('no wounds');
			expect(wounds.segments[1].intent).toEqual({ kind: 'setWounds', value: 1 });
			expect(wounds.segments[3].intent).toEqual({ kind: 'setWounds', value: 4 });
		});

		it('has no wounds meter when the maximum is 0', () => {
			const hero = blankHero({ system: { attributes: { wounds: { value: 0, max: 0 } } } });

			expect(heroRail(hero, heroContext()).meters.some((m) => m.kind === 'wounds')).toBe(false);
		});

		it('gives Hit Dice of one size a number to type, and a Roll', () => {
			const hitDice = heroRail(blankHero(), heroContext()).meters.find((m) => m.kind === 'hitDice');

			expect(hitDice).toMatchObject({
				value: 1,
				max: 1,
				sizes: 'd12',
				typeable: true,
				summary: '1/1',
				roll: { intent: { kind: 'rollHitDice' }, label: 'NIMBLE.actorSheet.hero.meter.roll' },
				edit: null,
			});
		});

		it('gives Hit Dice of two sizes the edit window in place of the number', () => {
			const hero = blankHero({
				system: {
					attributes: {
						hitDice: { '12': { current: 1 }, '6': { current: 2 } },
						bonusHitDice: [{ size: 6, value: 2 }],
					},
				},
			});
			const hitDice = heroRail(hero, heroContext()).meters.find((m) => m.kind === 'hitDice');

			expect(hitDice).toMatchObject({
				value: 3,
				max: 3,
				sizes: 'd12 + d6',
				typeable: false,
				edit: {
					intent: { kind: 'editHitDice' },
					label: 'NIMBLE.hitDice.editCurrentHitDice',
				},
			});
		});

		it('shows mana only for a class with mana, and idle until Initiative when mana comes from it', () => {
			expect(heroRail(blankHero(), heroContext()).meters.some((m) => m.kind === 'mana')).toBe(
				false,
			);

			const caster = blankHero({ system: { resources: { mana: { current: 3, max: 5 } } } });
			expect(heroRail(caster, heroContext()).meters.find((m) => m.kind === 'mana')).toMatchObject({
				value: 3,
				max: 5,
				idle: null,
				summary: '3/5',
			});

			const fromInitiative = heroRail(caster, heroContext({ manaFromInitiative: true }));
			expect(fromInitiative.meters.find((m) => m.kind === 'mana')).toMatchObject({
				idle: {
					note: 'NIMBLE.actorSheet.hero.meter.fromInitiative',
					hint: 'NIMBLE.actorSheet.hero.meter.idleHint',
				},
				summary: '',
			});
			const rolled = heroRail(
				caster,
				heroContext({ manaFromInitiative: true, combat: heroTurn() }),
			);
			expect(rolled.meters.find((m) => m.kind === 'mana')).toMatchObject({ idle: null });
		});

		it('gives a dice pool its faces and a roll of one more die', () => {
			const context = heroContext({
				dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [4, 2] }],
			});
			const pool = heroRail(blankHero(), context).meters.find((m) => m.kind === 'dicePool');

			expect(pool).toMatchObject({
				id: 'fury',
				poolKind: 'dice',
				die: 6,
				faces: [4, 2],
				faceLabels: [
					'NIMBLE.actorSheet.hero.meter.dieLabel {"label":"Fury Dice","number":"1","face":"4"}',
					'NIMBLE.actorSheet.hero.meter.dieLabel {"label":"Fury Dice","number":"2","face":"2"}',
				],
				max: 3,
				summary: '4 2',
				add: { intent: { kind: 'rollIntoDicePool', poolId: 'fury', label: 'Fury Dice' } },
			});
			const full = heroContext({
				dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 2, faces: [4, 2] }],
			});
			expect(heroRail(blankHero(), full).meters.find((m) => m.kind === 'dicePool')).toMatchObject({
				add: null,
			});
		});

		it('shows a charge pool with a die and a promoted pool, and never a hidden one', () => {
			const pool = (id: string, extra: object) => ({
				id,
				label: id,
				current: 2,
				max: 4,
				dieSize: null,
				hidden: false,
				showAsResource: false,
				...extra,
			});
			const context = heroContext({
				chargePools: [
					pool('combatDice', { dieSize: 'd8' }),
					pool('promoted', { showAsResource: true }),
					pool('itemOnly', {}),
					pool('hiddenDice', { dieSize: 'd6', hidden: true }),
				],
			});
			const meters = heroRail(blankHero(), context).meters.filter((m) => m.kind === 'charges');

			expect(meters.map((m) => m.id)).toEqual(['combatDice', 'promoted']);
			expect(meters[0]).toMatchObject({
				poolKind: 'charges',
				die: 8,
				summary: '2/4',
				rollOne: {
					intent: { kind: 'rollPoolCharge', poolId: 'combatDice', label: 'combatDice' },
					label: 'NIMBLE.actorSheet.hero.meter.rollOne {"label":"combatDice"}',
				},
			});
			expect(meters[1]).toMatchObject({ poolKind: 'uses', die: null, rollOne: null });
		});
	});

	describe('rests and initiative', () => {
		it('shows the rests out of combat only', () => {
			expect(heroRail(blankHero(), heroContext()).rests).toEqual([
				{
					label: 'NIMBLE.prompts.fieldRest',
					icon: 'fa-regular fa-hourglass-half',
					intent: { kind: 'rest', restType: 'field' },
				},
				{
					label: 'NIMBLE.prompts.safeRest',
					icon: 'fa-solid fa-moon',
					intent: { kind: 'rest', restType: 'safe' },
				},
			]);
			expect(heroRail(blankHero(), heroContext({ combat: heroTurn() })).rests).toBeNull();
		});

		it('always shows Roll Initiative with the modifier and its roll mode', () => {
			const hero = blankHero({
				system: { attributes: { initiative: { mod: 3, defaultRollMode: 1 } } },
			});

			for (const combat of [null, heroTurn()]) {
				expect(heroRail(hero, heroContext({ combat })).initiative).toMatchObject({
					mod: '+3',
					rollMode: { value: 1 },
					intent: { kind: 'rollInitiative' },
				});
			}
		});

		it('makes Roll Initiative wait while a roll is on its way', () => {
			const combat = heroTurn({ initiativeRolled: false, initiativePending: true });

			expect(heroRail(blankHero(), heroContext({ combat })).initiative.intent).toBeNull();
		});
	});

	describe('turn', () => {
		it('has no turn box out of combat, or before Initiative', () => {
			expect(heroRail(blankHero(), heroContext()).turn).toBeNull();
			const notRolled = heroContext({ combat: heroTurn({ initiativeRolled: false }) });
			expect(heroRail(blankHero(), notRolled).turn).toBeNull();
		});

		it('gives each action cell the intent that spends or restores one action', () => {
			const combat = heroTurn({ actions: { current: 2, effectiveMax: 3 } });
			const turn = heroRail(blankHero(), heroContext({ combat })).turn;

			expect(turn?.cells.map((c) => [c.available, c.intent])).toEqual([
				[true, { kind: 'setActions', value: 1 }],
				[true, { kind: 'setActions', value: 1 }],
				[false, { kind: 'setActions', value: 3 }],
			]);
			expect(turn?.addAction).toEqual({
				intent: { kind: 'addAction' },
				label: 'NIMBLE.ui.heroicActions.addAdditionalAction',
			});
		});

		it('has no extra action at the limit of a turn', () => {
			const combat = heroTurn({ actions: { current: 2, effectiveMax: 2, mayAdd: false } });

			expect(heroRail(blankHero(), heroContext({ combat })).turn?.addAction).toBeNull();
		});

		it('asks before End turn while actions are left', () => {
			const left = heroRail(blankHero(), heroContext({ combat: heroTurn() })).turn;
			expect(left?.endTurn).toEqual({
				intent: { kind: 'endTurn' },
				label: 'NIMBLE.ui.heroicActions.endTurn',
				question: `${RAIL}.endTurnQuestion`,
				cancelLabel: 'NIMBLE.actorSheet.hero.turn.keepPlaying',
			});

			const none = heroContext({ combat: heroTurn({ actions: { current: 0 } }) });
			expect(heroRail(blankHero(), none).turn?.endTurn).toMatchObject({
				intent: { kind: 'endTurn' },
				question: null,
			});
		});

		it('has no End turn when it is not your turn', () => {
			const turn = heroRail(blankHero(), heroContext({ combat: heroTurn({ isTurn: false }) })).turn;

			expect(turn?.endTurn).toBeNull();
			expect(turn?.heading).toBe(`${RAIL}.notYourTurn`);
		});

		it('says how many actions the next turn gains or loses', () => {
			const pending = (pendingDelta: number) =>
				heroRail(blankHero(), heroContext({ combat: heroTurn({ actions: { pendingDelta } }) })).turn
					?.pending;

			expect(pending(0)).toBeNull();
			expect(pending(1)).toBe('NIMBLE.ui.heroicActions.pendingActionGain {"count":"1"}');
			expect(pending(-2)).toBe('NIMBLE.ui.heroicActions.pendingActionsLoss {"count":"2"}');
		});
	});

	describe('rare actions', () => {
		it('lets a hero with a class below level 20 level up', () => {
			expect(heroRail(blankHero(), heroContext()).levelUp).toEqual({
				label: 'NIMBLE.prompts.levelUp',
				intent: { kind: 'levelUp' },
				tooltip: `${RAIL}.levelUpHint`,
			});
		});

		it('turns Level Up off with no class or at level 20, and says why', () => {
			const max = blankHero();
			max.items[0].system.classLevel = 20;
			expect(heroRail(max, heroContext()).levelUp).toEqual({
				label: 'NIMBLE.prompts.levelUp',
				intent: null,
				tooltip: `${RAIL}.levelUpMax`,
			});

			const noClass = blankHero({ items: [] });
			expect(heroRail(noClass, heroContext()).levelUp.intent).toBeNull();
			expect(heroRail(noClass, heroContext()).levelUp.tooltip).toBe(`${RAIL}.levelUpNoClass`);
		});

		it('lets you revert a level up only with a history', () => {
			expect(heroRail(blankHero(), heroContext()).revertLevelUp).toBeNull();
			const leveled = blankHero({ system: { levelUpHistory: [{ level: 2 }] } });
			expect(heroRail(leveled, heroContext()).revertLevelUp).toEqual({
				label: `${RAIL}.revertLevelUp`,
				intent: { kind: 'revertLevelUp' },
			});
		});

		it('warns about a missed level choice and opens the correction', () => {
			expect(heroRail(blankHero(), heroContext()).levelCorrection).toBeNull();

			const view = heroRail(blankHero(), heroContext({ missingLevelSelections: [3, 5] }));
			expect(view.levelCorrection).toEqual({
				label: 'NIMBLE.levelCorrectionDialog.sheetWarning',
				tooltip: 'NIMBLE.levelCorrectionDialog.sheetWarningTooltip {"level":"3"}',
				intent: { kind: 'correctLevels' },
			});
		});
	});

	describe('armor and speed', () => {
		it('shows armor, walking speed, and each other speed above 0 with its bonus note', () => {
			const hero = blankHero({
				system: { attributes: { movement: { walk: 8, climb: 3 } } },
				items: [
					heroItem({
						type: 'feature',
						name: 'Swift',
						rules: [{ id: 'r', type: 'speedBonus', active: true, amount: 2, fields: {} }],
					}),
				],
			});
			const view = heroRail(hero, heroContext());

			expect(view.armor.value).toBe(2);
			expect(view.speeds.map((s) => [s.type, s.value, s.note])).toEqual([
				['walk', 8, '+2'],
				['climb', 3, null],
			]);
		});
	});
});
