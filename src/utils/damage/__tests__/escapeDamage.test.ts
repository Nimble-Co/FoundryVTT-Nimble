import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent, TurnDamageAction } from '#types/cardEvent.d.ts';

const addCardEvents = vi.fn(async (..._args: unknown[]) => true);
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const dealTurnDamageTo = vi.fn(async (..._args: unknown[]) => ({
	hpLost: 7,
	tempLost: 0,
	woundsGained: 0,
}));
const undoTurnDamage = vi.fn(async (..._args: unknown[]) => true);
const saveRequestEvents = vi.fn((..._args: unknown[]): CardEvent[] => []);
let automation = true;

let module: typeof import('../escapeDamage.js');

const holder = {
	uuid: 'Actor.goblin',
	name: 'Goblin',
	getRollData: () => ({ key: 3 }),
};
const escaped = { effectId: 'trap', effectName: 'Shadow Trap', img: 'trap.svg', sourceUuid: null };
let card: { id: string; flags: Record<string, { events?: CardEvent[] }> };

const lines = () => addCardEvents.mock.calls.flatMap(([, events]) => events as CardEvent[]);

beforeEach(async () => {
	vi.clearAllMocks();
	saveRequestEvents.mockReturnValue([]);
	automation = true;
	card = { id: 's1', flags: { [SYSTEM_ID]: { events: [] } } };
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		addCardEvents,
		replaceCardEvent,
	}));
	vi.doMock('#utils/damage/turnDamageLine.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		dealTurnDamageTo,
		undoTurnDamage,
	}));
	vi.doMock('#utils/rolls/showDiceAnimation.js', () => ({ showDiceAnimation: async () => {} }));
	vi.doMock('#utils/saveRequest/saveRequests.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		saveRequestEvents,
	}));
	vi.doMock('../../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	module = await import('../escapeDamage.js');
	vi.stubGlobal(
		'Roll',
		class {
			total = 0;
			constructor(
				public formula: string,
				public data: Record<string, number>,
			) {}
			async evaluate() {
				const plain = this.formula.replace(/@(\w+)/g, (_m, key) => String(this.data[key]));
				this.total = Number(Function(`return ${plain}`)());
				return this;
			}
		},
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('escapeDamageRulesOf', () => {
	it('reads the prepared Damage on Escape rules of the effect that are on', () => {
		const rule = (id: string, type: string, on = true) => ({
			id,
			type,
			formula: '7',
			damageType: '',
			appliesTo: () => on,
		});
		const effect = {
			rules: new Map([
				['a', rule('a', 'escapeDamage')],
				['b', rule('b', 'turnDamage')],
				['c', rule('c', 'escapeDamage', false)],
			]),
		};

		expect(module.escapeDamageRulesOf(effect).map((each) => each.id)).toEqual(['a']);
	});

	it('reads the rule data of an effect with no prepared rules', () => {
		const effect = {
			system: {
				rules: [
					{ id: 'a', type: 'escapeDamage', formula: '1d12', damageType: 'necrotic' },
					{ id: 'b', type: 'escapeDamage', formula: '1', disabled: true },
				],
			},
		};

		expect(module.escapeDamageRulesOf(effect)).toEqual([
			{ id: 'a', formula: '1d12', damageType: 'necrotic' },
		]);
	});
});

describe('escapeDamageRulesOf with stacks', () => {
	it('puts the stacks of the effect into the formula, as the effect is gone when it rolls', () => {
		const effect = {
			system: {
				stacks: { on: true, count: 2 },
				rules: [{ id: 'a', type: 'escapeDamage', formula: '(@stacks)d4', damageType: '' }],
			},
		};

		expect(module.escapeDamageRulesOf(effect)[0].formula).toBe('(2)d4');
	});
});

describe('dealEscapeDamage', () => {
	it('rolls the damage on the holder, deals it, and puts the line on the roll card', async () => {
		await module.dealEscapeDamage(card, holder as never, escaped, [
			{ id: 'r1', formula: '4 + @key', damageType: '' },
		]);

		expect(dealTurnDamageTo).toHaveBeenCalledWith(
			holder,
			expect.objectContaining({ amount: 7, damageType: '', wounds: 0 }),
			{ id: 's1' },
		);
		const [line] = lines();
		expect(addCardEvents.mock.calls[0][0]).toBe(card);
		expect(line.id).toMatch(/^escapeDamage\.Actor\.goblin\.trap\.r1\./);
		expect(line.text).toMatchObject({ key: 'NIMBLE.chat.turnDamage.takes' });
		expect(line.cause).toEqual({
			key: 'NIMBLE.chat.escapeDamage.cause',
			data: { effect: 'Shadow Trap', formula: '4 + @key' },
		});
		expect(line.action).toMatchObject({ kind: 'turnDamage', state: 'dealt', hpLost: 7 });
	});

	it('adds the save lines that taking damage asks for', async () => {
		const ask = { id: 'save', kind: 'saveRequest' } as CardEvent;
		saveRequestEvents.mockReturnValue([ask]);

		await module.dealEscapeDamage(card, holder as never, escaped, [
			{ id: 'r1', formula: '7', damageType: '' },
		]);

		expect(saveRequestEvents).toHaveBeenCalledWith(holder, 'takeDamage');
		expect(lines()[1]).toBe(ask);
	});

	it('does nothing for a blank formula or a total of 0', async () => {
		await module.dealEscapeDamage(card, holder as never, escaped, [
			{ id: 'r1', formula: ' ', damageType: '' },
			{ id: 'r2', formula: '0', damageType: '' },
		]);

		expect(dealTurnDamageTo).not.toHaveBeenCalled();
		expect(addCardEvents).not.toHaveBeenCalled();
	});

	it('with Feature Effects off, the line waits for a click', async () => {
		automation = false;

		await module.dealEscapeDamage(card, holder as never, escaped, [
			{ id: 'r1', formula: '7', damageType: 'fire' },
		]);

		expect(dealTurnDamageTo).not.toHaveBeenCalled();
		expect((lines()[0].action as TurnDamageAction).state).toBe('waiting');
	});
});

describe('takeBackEscapeDamage', () => {
	const damageLine = (id: string, state: TurnDamageAction['state']): CardEvent => ({
		id,
		kind: 'damage',
		icon: 'x',
		text: { key: 'NIMBLE.chat.turnDamage.takes' },
		action: {
			kind: 'turnDamage',
			holderUuid: 'Actor.goblin',
			holderName: 'Goblin',
			amount: 7,
			damageType: '',
			wounds: 0,
			sourceUuid: null,
			state,
		},
		at: 1,
	});

	it('gives back the damage this escape dealt, and takes its lines off', async () => {
		const dealt = damageLine('escapeDamage.Actor.goblin.trap.r1.1', 'dealt');
		const waiting = damageLine('escapeDamage.Actor.goblin.trap.r2.1', 'waiting');
		const other = damageLine('escapeDamage.Actor.goblin.web.r1.1', 'dealt');
		card.flags[SYSTEM_ID].events = [dealt, waiting, other];

		await module.takeBackEscapeDamage(card, { holderUuid: 'Actor.goblin', effectId: 'trap' });

		expect(undoTurnDamage).toHaveBeenCalledTimes(1);
		expect(undoTurnDamage).toHaveBeenCalledWith(card, dealt);
		expect(replaceCardEvent).toHaveBeenCalledWith(card, dealt.id, null);
		expect(replaceCardEvent).toHaveBeenCalledWith(card, waiting.id, null);
		expect(replaceCardEvent).not.toHaveBeenCalledWith(card, other.id, null);
	});
});
