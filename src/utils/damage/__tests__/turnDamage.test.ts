import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, TurnDamageAction } from '#types/cardEvent.d.ts';

const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);
const momentEventIds = vi.fn((_key: string) => new Set<string>());
const momentCardEl = { id: 'momentCard' };
const momentCard = vi.fn((_key: string): unknown => momentCardEl);
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const spacesBetween = vi.fn((_a: unknown, _b: unknown) => 1);
const fireEvent = vi.fn();
const chargeOnLightning = vi.fn(async (..._args: unknown[]) => {});
const saveRequestEvents = vi.fn((..._args: unknown[]): CardEvent[] => []);
let automation = true;

let dealTurnDamage: typeof import('../turnDamage.js').dealTurnDamage;

const moment = {
	key: 'combat1:2:c-tessa:turnStart',
	heading: { key: 'NIMBLE.lastsUntil.chat.heading.turnStart', data: { name: 'Tessa' } },
};

interface Creature {
	uuid: string;
	name: string;
	isOwner: boolean;
	statuses: Set<string>;
	rules: unknown[];
	system: { attributes: { hp: { value: number; temp: number; max: number }; wounds?: object } };
	applyDamage: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
}

function creature(uuid: string, name: string, { wounds = false, hp = 20, temp = 0 } = {}) {
	const actor: Creature = {
		uuid,
		name,
		isOwner: true,
		statuses: new Set(),
		rules: [],
		system: {
			attributes: {
				hp: { value: hp, temp, max: 20 },
				...(wounds ? { wounds: { value: 0, max: 6 } } : {}),
			},
		},
		applyDamage: vi.fn(async (amount: number) => {
			const hpNow = actor.system.attributes.hp;
			const fromTemp = Math.min(hpNow.temp, amount);
			hpNow.temp -= fromTemp;
			hpNow.value = Math.max(0, hpNow.value - (amount - fromTemp));
		}),
		update: vi.fn(async (data: Record<string, unknown>) => {
			const value = data['system.attributes.wounds.value'];
			if (typeof value === 'number') {
				(actor.system.attributes.wounds as { value: number }).value = value;
			}
		}),
	};
	return actor;
}

function rule(owner: Creature, fields: Record<string, unknown> = {}) {
	return {
		id: `r-${owner.name}`,
		type: 'turnDamage',
		at: 'turnStart',
		who: 'holder',
		reach: 1,
		formula: '7',
		damageType: 'fire',
		wounds: 0,
		actor: { uuid: owner.uuid, getRollData: () => ({}) },
		parentDocument: { uuid: `${owner.uuid}.Item.cauldron`, name: 'In the Cauldron', img: 'c.svg' },
		appliesTo: () => true,
		...fields,
	};
}

let tessa: Creature;
let imp: Creature;
let tessaToken: Record<string, unknown>;
let impToken: Record<string, unknown>;

function turnOf(actor: Creature, token: Record<string, unknown>, defeated = false) {
	return { actor, token, isDefeated: defeated } as never;
}

/** The lines on the card of the moment: each written line, as its last change left it. */
const lines = () =>
	addMomentEvents.mock.calls
		.flatMap(([, events]) => events as CardEvent[])
		.map((line) => {
			const changes = replaceCardEvent.mock.calls.filter(([, id]) => id === line.id);
			return (changes.at(-1)?.[2] as CardEvent | undefined) ?? line;
		});
const actionOf = (event: CardEvent) => event.action as TurnDamageAction;

beforeEach(async () => {
	for (const mock of [addMomentEvents, spacesBetween, fireEvent, chargeOnLightning]) {
		mock.mockClear();
	}
	addMomentEvents.mockImplementation(async () => true);
	replaceCardEvent.mockClear();
	momentCard.mockClear().mockReturnValue(momentCardEl);
	momentEventIds.mockReset().mockImplementation(() => new Set<string>());
	saveRequestEvents.mockClear().mockReturnValue([]);
	spacesBetween.mockReturnValue(1);
	automation = true;
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		addMomentEvents,
		momentEventIds,
		momentCard,
		replaceCardEvent,
	}));
	vi.doMock('#utils/movement/spacesBetween.js', () => ({ spacesBetween }));
	vi.doMock('#utils/rolls/showDiceAnimation.js', () => ({ showDiceAnimation: async () => {} }));
	vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		fireEvent,
	}));
	vi.doMock('#utils/actor/chargedOnLightning.js', () => ({ chargeOnLightning }));
	vi.doMock('#utils/saveRequest/saveRequests.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		saveRequestEvents,
	}));
	vi.doMock('../../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	({ dealTurnDamage } = await import('../turnDamage.js'));
	for (const path of [
		'#utils/chat/cardEvents.js',
		'#utils/movement/spacesBetween.js',
		'#utils/rolls/showDiceAnimation.js',
		'#utils/lastsUntil/lastsUntilEvents.js',
		'#utils/actor/chargedOnLightning.js',
		'#utils/saveRequest/saveRequests.js',
		'../../../settings/automationSettings.js',
	]) {
		vi.doUnmock(path);
	}

	tessa = creature('Actor.tessa', 'Tessa', { wounds: true });
	imp = creature('Scene.s.Token.imp.Actor.imp', 'Imp');
	const scene = { tokens: [] as unknown[] };
	tessaToken = { id: 'tessa', actor: tessa, parent: scene, combatant: null };
	impToken = { id: 'imp', actor: imp, parent: scene, combatant: null };
	scene.tokens.push(tessaToken, impToken);
	vi.stubGlobal(
		'Roll',
		class {
			total = 0;
			constructor(public formula: string) {}
			async evaluate() {
				this.total = Number(this.formula);
				return this;
			}
		},
	);
	const g = globalThis as unknown as { game: { user: unknown } };
	g.game.user = { id: 'gm', isGM: true, isActiveGM: true };
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('dealTurnDamage', () => {
	it("deals the holder's damage at its turn start, with one line on the card of the moment", async () => {
		tessa.rules = [rule(tessa)];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).toHaveBeenCalledWith(7);
		expect(addMomentEvents).toHaveBeenCalledTimes(1);
		expect(addMomentEvents.mock.calls[0][0]).toBe(moment);
		expect(lines()).toHaveLength(1);
		const [line] = lines();
		expect(line.text).toEqual({
			key: 'NIMBLE.chat.turnDamage.takes',
			data: {
				name: 'Tessa',
				damage: {
					key: 'NIMBLE.chat.turnDamage.typed',
					data: { amount: 7, type: { key: 'NIMBLE.damageTypes.fire' } },
				},
			},
		});
		expect(line.cause).toEqual({
			key: 'NIMBLE.chat.turnDamage.cause',
			data: { source: 'In the Cauldron', formula: '7' },
		});
		expect(actionOf(line)).toMatchObject({ state: 'dealt', hpLost: 7, tempLost: 0 });
	});

	it('writes the line before it deals the damage, then marks it dealt for Undo', async () => {
		tessa.rules = [rule(tessa)];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		const [written] = addMomentEvents.mock.calls[0][1] as CardEvent[];
		expect(actionOf(written)).toMatchObject({ state: 'waiting', amount: 7 });
		expect(addMomentEvents.mock.invocationCallOrder[0]).toBeLessThan(
			tessa.applyDamage.mock.invocationCallOrder[0],
		);
		expect(momentCard).toHaveBeenCalledWith(moment.key);
		expect(replaceCardEvent).toHaveBeenCalledWith(
			momentCardEl,
			written.id,
			expect.objectContaining({
				id: written.id,
				action: expect.objectContaining({ state: 'dealt', hpLost: 7 }),
			}),
		);
	});

	it('deals nothing when the line cannot be written', async () => {
		addMomentEvents.mockImplementation(async () => false);
		tessa.rules = [rule(tessa)];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).not.toHaveBeenCalled();
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});

	it('deals nothing when the card of the moment is not found', async () => {
		momentCard.mockReturnValue(undefined);
		tessa.rules = [rule(tessa)];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).not.toHaveBeenCalled();
	});

	it('rolls the formula with the roll data of the rule, so @stacks reads its effect', async () => {
		vi.stubGlobal(
			'Roll',
			class {
				total = 0;
				constructor(
					public formula: string,
					public data: Record<string, number> = {},
				) {}
				async evaluate() {
					this.total = Number(this.formula.replace('@stacks', String(this.data.stacks)));
					return this;
				}
			},
		);
		tessa.rules = [rule(tessa, { formula: '@stacks', rollData: () => ({ stacks: 4 }) })];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).toHaveBeenCalledWith(4);
	});

	it('does not fire a turn-end rule at the start of the turn', async () => {
		tessa.rules = [rule(tessa, { at: 'turnEnd' })];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('burns each creature within Reach of the holder, an ally too, and none farther away', async () => {
		imp.rules = [
			rule(imp, { who: 'nearby', formula: '3', parentDocument: { name: 'Burning Aura' } }),
		];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);
		expect(tessa.applyDamage).toHaveBeenCalledWith(3);
		expect(lines()[0].cause).toEqual({
			key: 'NIMBLE.chat.turnDamage.cause',
			data: {
				source: {
					key: 'NIMBLE.chat.turnDamage.nearSource',
					data: { source: 'Burning Aura', creature: 'Imp' },
				},
				formula: '3',
			},
		});

		tessa.applyDamage.mockClear();
		spacesBetween.mockReturnValue(2);
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), { ...moment, key: 'next' });
		expect(tessa.applyDamage).not.toHaveBeenCalled();
	});

	it('deals nothing to a dead or defeated creature, and nothing from a dead aura', async () => {
		tessa.rules = [rule(tessa)];
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken, true), moment);
		tessa.statuses.add('dead');
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);
		expect(tessa.applyDamage).not.toHaveBeenCalled();

		tessa.statuses.clear();
		tessa.rules = [];
		imp.rules = [rule(imp, { who: 'nearby' })];
		imp.statuses.add('dead');
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);
		expect(tessa.applyDamage).not.toHaveBeenCalled();
	});

	it('deals a moment once: a line already on its card is not dealt again', async () => {
		tessa.rules = [rule(tessa)];
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);
		const dealtId = lines()[0].id;

		momentEventIds.mockReturnValue(new Set([dealtId]));
		tessa.applyDamage.mockClear();
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(momentEventIds).toHaveBeenCalledWith(moment.key);
		expect(tessa.applyDamage).not.toHaveBeenCalled();
		expect(addMomentEvents).toHaveBeenCalledTimes(1);
	});

	it('with Feature Effects off, rolls and posts a waiting line, and deals nothing', async () => {
		automation = false;
		tessa.rules = [rule(tessa)];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(tessa.applyDamage).not.toHaveBeenCalled();
		expect(actionOf(lines()[0])).toMatchObject({ state: 'waiting', amount: 7 });
	});

	it('gives Wounds only to a creature with a Wound track', async () => {
		tessa.rules = [rule(tessa, { formula: '', wounds: 1 })];
		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);
		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 1 });
		expect(actionOf(lines()[0])).toMatchObject({ woundsGained: 1, hpLost: 0 });
		expect(lines()[0].text.key).toBe('NIMBLE.chat.turnDamage.gains');

		addMomentEvents.mockClear();
		const kobold = creature('Actor.kobold', 'Kobold');
		kobold.rules = [rule(kobold, { formula: '', wounds: 1 })];
		await dealTurnDamage('turnStart', turnOf(kobold, { ...tessaToken, actor: kobold }), moment);
		expect(kobold.update).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('sends its damage type to "takes damage" on the moment, and adds the save lines that asks', async () => {
		const save = { id: 'saveRequest.x', kind: 'saveRequest' } as CardEvent;
		saveRequestEvents.mockReturnValue([save]);
		tessa.rules = [rule(tessa, { damageType: 'lightning' })];

		await dealTurnDamage('turnStart', turnOf(tessa, tessaToken), moment);

		expect(fireEvent).toHaveBeenCalledWith(
			'takeDamage',
			tessa,
			{ damageTypes: ['lightning'] },
			{ moment },
		);
		expect(chargeOnLightning).toHaveBeenCalledWith(tessa, ['lightning'], 'Actor.tessa');
		expect(saveRequestEvents).toHaveBeenCalledWith(tessa, 'takeDamage');
		expect(lines().map((line) => line.kind)).toEqual(['damage', 'saveRequest']);
	});
});
