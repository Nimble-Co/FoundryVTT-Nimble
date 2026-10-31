import { describe, expect, it } from 'vitest';
import {
	dicePoolContext,
	dicePoolHero,
	heroContext,
	heroTurn,
	itemState,
	manaCaster,
	spellItem,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { itemRow, rowLine, spendIntent } from '../heroRows.ts';
import type { HeroActorLike } from '../heroSource.ts';

const SHARED = 'NIMBLE.actorSheet.shared';

const item = (hero: HeroActorLike, id: string) => {
	const found = hero.items.find((entry) => entry.id === id);
	if (!found) throw new Error(`no item ${id}`);
	return found;
};

describe('itemRow', () => {
	it('keeps the damage formula and the reach of a weapon on its line', () => {
		const hero = dicePoolHero();
		const view = itemRow(hero, item(hero, 'greataxe'), dicePoolContext());

		expect(view.summary).toBe(
			'2d6+3, NIMBLE.actorSheet.shared.reach {"distance":"1"}, NIMBLE.properties.twoHanded',
		);
		expect(view.drag).toEqual({ kind: 'item', uuid: 'Actor.blankHero00000001.Item.greataxe' });
		expect(view.edit).toEqual({ kind: 'openItem', itemId: 'greataxe' });
	});

	it('puts the first sentence of a feature on its line', () => {
		const hero = dicePoolHero();
		const view = itemRow(hero, item(hero, 'rage'), dicePoolContext());

		expect(view.summary).toBe('Enter a rage.');
		expect(view.description).toBe('Enter a rage.');
	});

	it('puts the facts first, then the first sentence', () => {
		expect(rowLine(['1/Safe Rest'], 'Enter a rage.')).toBe('1/Safe Rest - Enter a rage.');
		expect(rowLine([], '')).toBe('');
	});

	it('shows a spell with its range and damage type in words, and no numbers', () => {
		const hero = manaCaster();
		const view = itemRow(hero, item(hero, 'flameDart'), heroContext());

		expect(view.summary).toBe(
			`${SHARED}.range {"distance":"8"}, ${SHARED}.damageType {"type":"Fire"}`,
		);
		expect(view.use).toMatchObject({
			kind: 'act',
			intent: { kind: 'activate', itemId: 'flameDart' },
		});
		expect(view.facts).toContainEqual([`${SHARED}.facts.damage`, '1d10']);
	});

	it('reads the action cost from the item when the system gives no item state', () => {
		const hero = manaCaster();

		expect(itemRow(hero, item(hero, 'flameDart'), heroContext()).cost).toMatchObject({
			actions: 1,
		});
	});

	it('says Concentration on the line of a concentration spell', () => {
		const hero = manaCaster();
		hero.items.push(spellItem('wall', 'Wall of Fire', { selected: ['range', 'concentration'] }));

		expect(itemRow(hero, item(hero, 'wall'), heroContext()).summary).toBe(
			`${SHARED}.range {"distance":"8"}, ${SHARED}.concentration`,
		);
	});

	it('starts the line of a spell with its tier when asked', () => {
		const hero = manaCaster();
		const context = heroContext();

		expect(itemRow(hero, item(hero, 'ignite'), context, { withTier: true }).summary).toMatch(
			/^NIMBLE.ui.heroicActions.spellTier {"tier":"1"}, /,
		);
		expect(itemRow(hero, item(hero, 'iceLance'), context, { withTier: true }).summary).toMatch(
			/^NIMBLE.ui.heroicActions.cantrip, /,
		);
	});

	it('gives a tiered spell of a mana caster its mana cost, muted when the mana is short', () => {
		const hero = manaCaster({ system: { resources: { mana: { current: 0 } } } });

		expect(itemRow(hero, item(hero, 'ignite'), heroContext()).cost.pool).toEqual({
			kind: 'mana',
			icon: 'fa-solid fa-droplet',
			amount: 1,
			muted: true,
		});
		expect(itemRow(hero, item(hero, 'flameDart'), heroContext()).cost.pool).toBe(undefined);
	});

	it('counts the cells of an action cost that this turn cannot pay', () => {
		const hero = dicePoolHero();
		const context = dicePoolContext({ combat: heroTurn({ actions: { current: 0 } }) });

		expect(itemRow(hero, item(hero, 'rage'), context).cost).toMatchObject({
			actions: 1,
			actionsSpent: 1,
		});
	});

	it('shows the description that Foundry enriched, once the sheet has it', () => {
		const hero = dicePoolHero();
		const axe = item(hero, 'greataxe');
		const enriched = '<p>Roll <a class="inline-roll">1d6</a></p>';

		expect(itemRow(hero, axe, dicePoolContext()).descriptionHtml).toBeUndefined();
		expect(
			itemRow(hero, axe, dicePoolContext({ enrichedDescriptions: { greataxe: enriched } }))
				.descriptionHtml,
		).toBe(enriched);
	});

	it('ends a toggle that is on, and tags the row ACTIVE', () => {
		const hero = dicePoolHero();
		const context = dicePoolContext({
			itemState: { rage: itemState({ actionCost: 1, toggle: { ruleId: 'rageToggle', on: true } }) },
		});

		expect(itemRow(hero, item(hero, 'rage'), context)).toMatchObject({
			state: 'active',
			tag: `${SHARED}.active`,
			use: { kind: 'act', intent: { kind: 'endToggle', itemId: 'rage', ruleId: 'rageToggle' } },
		});
	});

	describe('pools and the gate', () => {
		const pool = { id: 'p', label: 'Charges', current: 0, max: 1, need: 1, per: 'round' as const };

		it('shows the uses of the item pools, and the numbers that you type in edit mode', () => {
			const hero = dicePoolHero();
			const context = dicePoolContext({ itemState: { rage: itemState({ pools: [pool] }) } });
			const view = itemRow(hero, item(hero, 'rage'), context);

			expect(view.cost.uses).toEqual([{ left: 0, max: 1, per: `${SHARED}.per.round`, need: 1 }]);
			expect(view.fields).toEqual([
				{
					kind: 'uses',
					poolId: 'p',
					label: `${SHARED}.usesOf {"name":"Rage","pool":"Charges"}`,
					value: 0,
					max: 1,
					per: `${SHARED}.per.round`,
				},
			]);
		});

		it('shows the spell limit counter from the charge pool of a spell', () => {
			const hero = manaCaster();
			const limit = { ...pool, label: 'Casts', current: 2, max: 3, per: 'safeRest' as const };
			const context = heroContext({ itemState: { flameDart: itemState({ pools: [limit] }) } });

			expect(itemRow(hero, item(hero, 'flameDart'), context).cost.uses).toEqual([
				{ left: 2, max: 3, per: `${SHARED}.per.safeRest`, need: 1 },
			]);
		});

		it('turns a row off with its reason when the gate blocks: Used this round', () => {
			const hero = dicePoolHero();
			const gate = {
				code: 'insufficientCharges' as const,
				poolLabel: 'Charges',
				poolMax: 1,
				per: 'round' as const,
			};
			const context = dicePoolContext({ itemState: { rage: itemState({ pools: [pool], gate }) } });
			const view = itemRow(hero, item(hero, 'rage'), context);

			const reason = `${SHARED}.reason.usedThis {"per":"${SHARED}.per.round"}`;
			expect(view.state).toBe('out');
			expect(view.use).toEqual({ kind: 'blocked', label: `Rage. ${reason}`, reason });
			expect(view.summary).toBe(reason);
		});

		it('names the pool when there is not enough in it', () => {
			const hero = dicePoolHero();
			const gate = {
				code: 'insufficientCharges' as const,
				poolLabel: 'Charges',
				poolMax: 3,
				per: null,
			};
			const context = dicePoolContext({ itemState: { rage: itemState({ gate }) } });

			expect(itemRow(hero, item(hero, 'rage'), context).use).toMatchObject({
				reason: `${SHARED}.reason.notEnough {"pool":"Charges"}`,
			});
		});
	});

	describe('the dice pool consumer step', () => {
		it('lists the dice of the pool, and a die at its top face is off for a maximize', () => {
			const hero = dicePoolHero();
			const frenzy = itemRow(hero, item(hero, 'bloodFrenzy'), dicePoolContext());

			if (frenzy.choice?.kind !== 'dice') throw new Error('no dice step');
			const [spend] = frenzy.choice.spends;
			expect(spend).toMatchObject({
				itemId: 'bloodFrenzy',
				ruleId: 'frenzyDice',
				poolId: 'fury',
				cap: 1,
			});
			expect(spend.faces.map((face) => [face.value, face.disabled])).toEqual([
				[5, false],
				[6, true],
			]);
			expect(spendIntent(spend, [1, 0])).toEqual({
				kind: 'spendDice',
				itemId: 'bloodFrenzy',
				ruleId: 'frenzyDice',
				poolId: 'fury',
				indices: [0, 1],
			});
		});

		it('says so when the pool is empty', () => {
			const hero = dicePoolHero();
			const context = dicePoolContext({
				dicePools: [{ id: 'fury', label: 'Fury Dice', dieSize: 'd6', max: 3, faces: [] }],
			});
			const view = itemRow(hero, item(hero, 'bloodlust'), context);

			expect(view.choice?.kind === 'dice' && view.choice.spends[0].empty).toBe(
				'NIMBLE.dicePoolTracker.spendRequestEmptyPool {"label":"Fury Dice"}',
			);
		});
	});
});
