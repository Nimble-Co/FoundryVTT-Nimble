import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VENGEANCE = 'packs/classFeatures/core/oathsworn/oathsworn-subclasses/oath-of-vengeance';
const packRules = (file: string) =>
	JSON.parse(readFileSync(resolve(VENGEANCE, file), 'utf8')).system.rules as Array<
		Record<string, unknown> & { type: string }
	>;

function hero(uuid: string, reachOfRule: number | null, order: string[] = []) {
	const item = { uuid: `${uuid}.Item.avenger` };
	return {
		uuid,
		type: 'character',
		rules:
			reachOfRule === null
				? []
				: [
						{
							type: 'poolDieToMax',
							trigger: 'onWound',
							reach: reachOfRule,
							item,
							appliesTo: () => true,
							raiseDice: vi.fn(async (count: number) => {
								order.push(`raise:${count}`);
							}),
						},
						{
							type: 'freeMove',
							trigger: 'afterPoolDiceToMax',
							item,
							offerAfterPoolDice: vi.fn(async () => {
								order.push('move');
							}),
						},
					],
	};
}

const token = (actor: unknown, x: number) => ({
	actor,
	x,
	disposition: 1,
	id: String(x),
});

describe('dice to max on Wounds', () => {
	let automation = true;

	async function load(spaces: (a: { x: number }, b: { x: number }) => number) {
		vi.resetModules();
		vi.doMock('#utils/movement/spacesBetween.js', () => ({ spacesBetween: spaces }));
		vi.doMock('#utils/movement/findActorToken.js', () => ({
			findActorToken: (actor: { token?: unknown }) => actor.token ?? null,
		}));
		vi.doMock('../../../settings/automationSettings.js', () => ({
			isRuleAutomationEnabled: () => automation,
		}));
		return import('../poolDieToMaxTrigger.js');
	}

	beforeEach(() => {
		automation = true;
		vi.stubGlobal('CONST', { TOKEN_DISPOSITIONS: { NEUTRAL: 0, SECRET: -2 } });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.doUnmock('#utils/movement/spacesBetween.js');
		vi.doUnmock('#utils/movement/findActorToken.js');
		vi.doUnmock('../../../settings/automationSettings.js');
	});

	it('raises one die per Wound on the hero, then arms the free move', async () => {
		const order: string[] = [];
		const { raisePoolDiceOnWounds } = await load(() => 0);

		await raisePoolDiceOnWounds(hero('Actor.hero', 4, order) as never, 2);

		expect(order).toEqual(['raise:2', 'move']);
	});

	it('uses the rule of a hero with the wounded ally in reach', async () => {
		const order: string[] = [];
		const avenger = hero('Actor.hero', 4, order);
		const ally = { ...hero('Actor.ally', null), token: token(null, 3) };
		Object.assign(ally.token, { parent: { tokens: [token(avenger, 0), ally.token] } });
		const { raisePoolDiceOnWounds } = await load((a, b) => Math.abs(a.x - b.x));

		await raisePoolDiceOnWounds(ally as never, 1);

		expect(order).toEqual(['raise:1', 'move']);
	});

	it('does nothing for an ally out of reach', async () => {
		const order: string[] = [];
		const avenger = hero('Actor.hero', 4, order);
		const ally = { ...hero('Actor.ally', null), token: token(null, 5) };
		Object.assign(ally.token, { parent: { tokens: [token(avenger, 0), ally.token] } });
		const { raisePoolDiceOnWounds } = await load((a, b) => Math.abs(a.x - b.x));

		await raisePoolDiceOnWounds(ally as never, 1);

		expect(order).toEqual([]);
	});

	it('does nothing for an ally with no token', async () => {
		const order: string[] = [];
		const { raisePoolDiceOnWounds } = await load(() => 0);

		await raisePoolDiceOnWounds(hero('Actor.ally', null) as never, 1);

		expect(order).toEqual([]);
	});

	it('with Feature Effects off, the dice stay and the move is still armed', async () => {
		automation = false;
		const order: string[] = [];
		const { raisePoolDiceOnWounds } = await load(() => 0);

		await raisePoolDiceOnWounds(hero('Actor.hero', 4, order) as never, 1);

		expect(order).toEqual(['move']);
	});
});

describe('the pack items of Judgment Dice', () => {
	it('Maximum Judgment raises a die on each attack, with a pick from the sheet', () => {
		const rules = packRules('maximum-judgment.json');
		expect(rules[0]).toMatchObject({
			type: 'poolDieToMax',
			trigger: 'onAttacked',
			poolIdentifier: 'judgment',
		});
		expect(rules[1]).toMatchObject({
			type: 'diceConsumer',
			selectionOutcome: 'maximize',
			mode: 'manual',
		});
	});

	it('Avenger raises dice on Wounds in Reach 4, and moves half speed', () => {
		const rules = packRules('avenger.json');
		expect(rules[0]).toMatchObject({ type: 'poolDieToMax', trigger: 'onWound', reach: 4 });
		expect(rules[1]).toMatchObject({
			type: 'freeMove',
			trigger: 'afterPoolDiceToMax',
			distance: 'floor(@speed / 2)',
		});
		expect(rules[2]).toMatchObject({ type: 'diceConsumer', selectionOutcome: 'maximize' });
	});
});
