import { describe, expect, it } from 'vitest';
import {
	blankHero,
	dicePoolContext,
	dicePoolHero,
	heroContext,
	heroTurn,
	manaCaster,
	weaponItem,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroActionsTab } from '../heroActionsTab.ts';
import type { HeroRowGroup, HeroRowView } from '../heroRows.ts';

const ACTIONS = 'NIMBLE.actorSheet.hero.actions';

const group = (groups: HeroRowGroup[], id: string) => groups.find((entry) => entry.id === id);
const names = (rows: HeroRowView[] | undefined) => rows?.map((row) => row.name);
const row = (groups: HeroRowGroup[], id: string) =>
	groups.flatMap((entry) => entry.rows).find((entry) => entry.id === id);

describe('heroActionsTab', () => {
	describe('weapons', () => {
		it('shows the equipped weapons and Unarmed Strike, A to Z', () => {
			const view = heroActionsTab(dicePoolHero(), dicePoolContext());

			expect(names(group(view.turnGroups, 'weapons')?.rows)).toEqual([
				'Greataxe',
				'NIMBLE.ui.heroicActions.unarmedStrike',
			]);
		});

		it('says how to attack with a weapon when the hero carries one but none is equipped', () => {
			const hero = blankHero();
			hero.items.push(weaponItem('sword', 'Sword', { equipped: false }));

			const weapons = group(heroActionsTab(hero, heroContext()).turnGroups, 'weapons');

			expect(weapons?.hint).toBe(`${ACTIONS}.equipHint`);
			expect(names(weapons?.rows)).toEqual(['NIMBLE.ui.heroicActions.unarmedStrike']);
		});

		it('has no hint for a hero with no weapon', () => {
			expect(group(heroActionsTab(blankHero(), heroContext()).turnGroups, 'weapons')?.hint).toBe(
				undefined,
			);
		});

		it('attacks with a weapon through the item activation, and with Unarmed Strike', () => {
			const view = heroActionsTab(dicePoolHero(), dicePoolContext());

			expect(row(view.turnGroups, 'greataxe')?.use).toMatchObject({
				kind: 'act',
				intent: { kind: 'activate', itemId: 'greataxe' },
			});
			expect(row(view.turnGroups, 'heroic-unarmedStrike')?.use).toMatchObject({
				kind: 'act',
				intent: { kind: 'unarmedStrike' },
			});
		});
	});

	describe('features', () => {
		it('lists the features that act, and not the passive ones', () => {
			const view = heroActionsTab(dicePoolHero(), dicePoolContext());

			expect(names(group(view.turnGroups, 'features')?.rows)).toEqual([
				'Blood Frenzy',
				'Bloodlust',
				'Rage',
			]);
		});

		it('shows Free for a feature with no action cost', () => {
			const view = heroActionsTab(dicePoolHero(), dicePoolContext());

			expect(row(view.turnGroups, 'bloodlust')?.cost).toMatchObject({ free: true });
			expect(row(view.turnGroups, 'rage')?.cost).toMatchObject({ actions: 1 });
		});

		it('has no Features group when no feature acts', () => {
			expect(group(heroActionsTab(blankHero(), heroContext()).turnGroups, 'features')).toBe(
				undefined,
			);
		});
	});

	describe('spells', () => {
		it('shows the spells only in combat', () => {
			expect(group(heroActionsTab(manaCaster(), heroContext()).turnGroups, 'spells')).toBe(
				undefined,
			);

			const inCombat = heroActionsTab(manaCaster(), heroContext({ combat: heroTurn() }));

			expect(names(group(inCombat.turnGroups, 'spells')?.rows)).toEqual([
				'Chillcraft',
				'Flame Dart',
				'Ice Lance',
				'Ignite',
			]);
		});

		it('puts a reaction spell in Reactions, in combat only', () => {
			const outOfCombat = heroActionsTab(manaCaster(), heroContext());
			const inCombat = heroActionsTab(manaCaster(), heroContext({ combat: heroTurn() }));

			expect(row(outOfCombat.reactionGroups, 'frostShield')).toBe(undefined);
			expect(row(inCombat.reactionGroups, 'frostShield')).toBeDefined();
		});
	});

	describe('heroic actions', () => {
		it('has Assess and Move', () => {
			const view = heroActionsTab(blankHero(), heroContext());

			expect(names(group(view.turnGroups, 'heroic')?.rows)).toEqual([
				'NIMBLE.ui.heroicActions.actions.assess.label',
				'NIMBLE.ui.heroicActions.actions.move.label',
			]);
		});

		it('moves for 1 action', () => {
			const move = row(heroActionsTab(blankHero(), heroContext()).turnGroups, 'heroic-move');

			expect(move?.use).toMatchObject({ kind: 'act', intent: { kind: 'move' } });
			expect(move?.cost).toMatchObject({ actions: 1 });
			expect(move?.drag).toEqual({
				kind: 'heroicAction',
				actionId: 'move',
				actionType: 'action',
				name: 'NIMBLE.ui.heroicActions.actions.move.label',
			});
		});

		it('Assess: choose one of three options, then a skill, then roll', () => {
			const assess = row(heroActionsTab(blankHero(), heroContext()).turnGroups, 'heroic-assess');

			expect(assess?.use?.kind).toBe('choose');
			if (assess?.choice?.kind !== 'twoStep') throw new Error('no two-step choice');
			expect(assess.choice.backLabel).toBe('NIMBLE.actorSheet.hero.actions.back');
			expect(assess.choice.options.map((option) => option.id)).toEqual([
				'ask-question',
				'create-opening',
				'anticipate-danger',
			]);
			const skills = assess.choice.options[1].next.options;
			expect(skills).toHaveLength(10);
			expect(skills[0]).toEqual({
				label: 'NIMBLE.skills.arcana −1',
				intent: { kind: 'assess', option: 'create-opening', skill: 'arcana' },
			});
		});
	});

	describe('reactions', () => {
		it('has the four heroic reactions and the reaction features, A to Z', () => {
			const view = heroActionsTab(dicePoolHero(), dicePoolContext());

			expect(view.reactionGroups[0].rows.map((entry) => entry.id)).toEqual([
				'heroic-defend',
				'heroic-help',
				'heroic-interpose',
				'heroic-opportunity',
				'thatAllYouGot',
			]);
		});

		it('puts the first sentence of a reaction that is not spent on its line', () => {
			const defend = row(
				heroActionsTab(blankHero(), heroContext()).reactionGroups,
				'heroic-defend',
			);

			expect(defend?.description).toBeTruthy();
			expect(defend?.summary).toBe(defend?.description);
		});

		it('names the target in the choice step and never blocks without one', () => {
			const none = row(heroActionsTab(blankHero(), heroContext()).reactionGroups, 'heroic-defend');
			const one = row(
				heroActionsTab(blankHero(), heroContext({ targets: ['Goblin'] })).reactionGroups,
				'heroic-help',
			);

			expect(none?.choice).toMatchObject({
				kind: 'options',
				lines: [`${ACTIONS}.noTarget`],
				options: [{ intent: { kind: 'reaction', reaction: 'defend' } }],
			});
			expect(one?.choice).toMatchObject({ lines: [`${ACTIONS}.target {"name":"Goblin"}`] });
		});

		it('Opportunity Attack: the equipped melee weapons and Unarmed Strike', () => {
			const hero = dicePoolHero();
			hero.items.push(weaponItem('bow', 'Bow', { properties: ['range'], attackType: 'range' }));
			hero.items.push(weaponItem('dagger', 'Dagger', { properties: ['thrown'] }));

			const opportunity = row(
				heroActionsTab(hero, dicePoolContext()).reactionGroups,
				'heroic-opportunity',
			);

			expect(opportunity?.choice?.kind === 'options' && opportunity.choice.options).toEqual([
				{ label: 'Dagger', intent: { kind: 'opportunityAttack', weaponId: 'dagger' } },
				{ label: 'Greataxe', intent: { kind: 'opportunityAttack', weaponId: 'greataxe' } },
				{
					label: 'NIMBLE.ui.heroicActions.unarmedStrike',
					intent: { kind: 'opportunityAttack', weaponId: null },
				},
			]);
		});

		it('marks a reaction used this round, and still lets you open it', () => {
			const combat = heroTurn({ isTurn: false, reactionsSpent: ['defend'] });
			const defend = row(
				heroActionsTab(blankHero(), heroContext({ combat })).reactionGroups,
				'heroic-defend',
			);

			expect(defend).toMatchObject({
				state: 'used',
				tag: 'NIMBLE.actorSheet.shared.used',
				use: { kind: 'choose' },
			});
		});

		it('notes when reactions apply, and shows them first when it is not your turn', () => {
			const out = heroActionsTab(blankHero(), heroContext());
			const notYourTurn = heroActionsTab(
				blankHero(),
				heroContext({ combat: heroTurn({ isTurn: false }) }),
			);

			expect(out.reactionGroups[0]).toMatchObject({
				note: `${ACTIONS}.reactionsNote.outOfCombat`,
				now: false,
			});
			expect(out.reactionsFirst).toBe(false);
			expect(notYourTurn.reactionGroups[0]).toMatchObject({
				note: `${ACTIONS}.reactionsNote.notYourTurn`,
				now: true,
			});
			expect(notYourTurn.reactionsFirst).toBe(true);
		});
	});

	it('turns no row off out of combat', () => {
		const view = heroActionsTab(dicePoolHero(), dicePoolContext());
		const rows = [...view.turnGroups, ...view.reactionGroups].flatMap((entry) => entry.rows);

		expect(rows.filter((entry) => entry.use?.kind === 'blocked')).toEqual([]);
	});
});
