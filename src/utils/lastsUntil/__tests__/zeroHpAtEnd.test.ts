import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, ZeroHpAction } from '#types/cardEvent.d.ts';
import { UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);
let automation = true;

let zero: typeof import('../zeroHpAtEnd.js');

function hero(value = 14, max = 20) {
	const actor = Object.assign(Object.create(Actor.prototype), {
		uuid: 'Actor.tessa',
		name: 'Tessa',
		isOwner: true,
		system: { attributes: { hp: { value, temp: 0, max } } },
		update: vi.fn(async (data: Record<string, unknown>, _options?: object) => {
			for (const [path, next] of Object.entries(data)) {
				foundry.utils.setProperty(actor, path, next);
			}
		}),
	});
	return actor as {
		uuid: string;
		name: string;
		system: { attributes: { hp: { value: number; temp: number; max: number } } };
		update: ReturnType<typeof vi.fn>;
	};
}

const rule = (fields: Record<string, unknown> = {}) => ({
	id: 'r1',
	type: 'zeroHpAtEnd',
	appliesTo: () => true,
	...fields,
});

function endingEffect(holder: object, rules: Record<string, unknown>[] = [rule()]) {
	return {
		id: 'dragon',
		uuid: 'Actor.tessa.ActiveEffect.dragon',
		name: 'Dragonform',
		img: 'icons/dragon.svg',
		parent: holder,
		rules: new Map(rules.map((each, index) => [String(index), each])),
	};
}

let tessa: ReturnType<typeof hero>;
let user: { id: string; isGM: boolean; isActiveGM: boolean };

beforeEach(async () => {
	vi.clearAllMocks();
	automation = true;
	tessa = hero();
	user = { id: 'gm', isGM: true, isActiveGM: true };
	(globalThis as unknown as { game: Record<string, unknown> }).game.user = user;
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === tessa.uuid ? tessa : null)),
	);
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		replaceCardEvent,
		addMomentEvents,
	}));
	vi.doMock('../../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	zero = await import('../zeroHpAtEnd.js');
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('dropsToZeroAtEnd', () => {
	it('is true for an effect with a 0 HP at End rule that is on', () => {
		expect(zero.dropsToZeroAtEnd(endingEffect(tessa))).toBe(true);
	});

	it('is false with no such rule, a disabled rule, or a rule whose condition fails', () => {
		expect(zero.dropsToZeroAtEnd(endingEffect(tessa, [rule({ type: 'turnDamage' })]))).toBe(false);
		expect(zero.dropsToZeroAtEnd(endingEffect(tessa, [rule({ disabled: true })]))).toBe(false);
		expect(zero.dropsToZeroAtEnd(endingEffect(tessa, [rule({ appliesTo: () => false })]))).toBe(
			false,
		);
	});

	it('reads the rule data of an effect with no prepared rules', () => {
		expect(zero.dropsToZeroAtEnd({ system: { rules: [{ type: 'zeroHpAtEnd' }] } })).toBe(true);
		expect(
			zero.dropsToZeroAtEnd({ system: { rules: [{ type: 'zeroHpAtEnd', disabled: true }] } }),
		).toBe(false);
	});
});

describe('zeroHpAtEndEvents', () => {
	it('drops the holder to 0 HP and gives a line with Undo', async () => {
		const [line] = await zero.zeroHpAtEndEvents([endingEffect(tessa)], 50);

		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.hp.value': 0 });
		expect(tessa.system.attributes.hp.value).toBe(0);
		expect(line).toMatchObject({
			kind: 'healthState',
			img: 'icons/dragon.svg',
			text: { key: 'NIMBLE.chat.zeroHpAtEnd.drops', data: { name: 'Tessa' } },
			cause: { key: 'NIMBLE.chat.zeroHpAtEnd.cause', data: { effect: 'Dragonform' } },
			action: {
				kind: 'zeroHp',
				holderUuid: 'Actor.tessa',
				holderName: 'Tessa',
				state: 'dropped',
				hpLost: 14,
			},
			at: 50,
		});
	});

	it('with Feature Effects off, keeps the HP and gives a line that waits for a click', async () => {
		automation = false;

		const [line] = await zero.zeroHpAtEndEvents([endingEffect(tessa)], 50);

		expect(tessa.update).not.toHaveBeenCalled();
		expect(line?.action).toMatchObject({ kind: 'zeroHp', state: 'waiting' });
	});

	it('gives no line for an effect with no rule, or a holder at 0 HP already', async () => {
		const down = Object.assign(hero(0), { uuid: 'Actor.down' });

		const lines = await zero.zeroHpAtEndEvents([endingEffect(tessa, []), endingEffect(down)], 50);

		expect(lines).toEqual([]);
		expect(down.update).not.toHaveBeenCalled();
	});
});

describe('dropToZeroOnDelete (an end with no line of its own, such as a removal by hand)', () => {
	const heading = { key: 'NIMBLE.lastsUntil.chat.heading.effectEnds' };

	it('on the active GM, drops the holder and puts the line on a card of its own', async () => {
		await zero.dropToZeroOnDelete(endingEffect(tessa), {}, heading);

		expect(tessa.system.attributes.hp.value).toBe(0);
		expect(addMomentEvents).toHaveBeenCalledTimes(1);
		const [moment, events] = addMomentEvents.mock.calls[0] as [
			{ key: string; heading: unknown },
			CardEvent[],
		];
		expect(moment.key).toMatch(/^once:/);
		expect(moment.heading).toEqual(heading);
		expect(events.map((event) => event.action?.kind)).toEqual(['zeroHp']);
	});

	it('does nothing for an end that writes its own lines, or a copy that replaces it', async () => {
		await zero.dropToZeroOnDelete(endingEffect(tessa), { [zero.END_LINES_OPTION]: true }, heading);
		await zero.dropToZeroOnDelete(endingEffect(tessa), { nimbleConditionReplaced: true }, heading);

		expect(tessa.update).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('drops the holder when a new Concentration replaces the one with the rule: it ends', async () => {
		const concentrating = {
			...endingEffect(tessa),
			statuses: new Set(['concentration']),
		};

		await zero.dropToZeroOnDelete(concentrating, { nimbleConditionReplaced: true }, heading);

		expect(tessa.system.attributes.hp.value).toBe(0);
		expect(addMomentEvents).toHaveBeenCalledTimes(1);
	});

	it('does nothing when an undo takes the application back', async () => {
		await zero.dropToZeroOnDelete(
			endingEffect(tessa),
			{ [UNDO_APPLICATION_OPTION]: true },
			heading,
		);

		expect(tessa.update).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('does nothing on a client that is not the active GM', async () => {
		user.isActiveGM = false;

		await zero.dropToZeroOnDelete(endingEffect(tessa), {}, heading);

		expect(tessa.update).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});
});

describe('actOnZeroHp', () => {
	const card = { id: 'card' };

	function zeroLine(state: ZeroHpAction['state'], fields: Partial<ZeroHpAction> = {}): CardEvent {
		return {
			id: 'zeroHp.line',
			kind: 'healthState',
			icon: 'fa-solid fa-heart-crack',
			text: { key: 'NIMBLE.chat.zeroHpAtEnd.drops', data: { name: 'Tessa' } },
			action: {
				kind: 'zeroHp',
				holderUuid: 'Actor.tessa',
				holderName: 'Tessa',
				effectName: 'Dragonform',
				state,
				...fields,
			},
			at: 1,
		};
	}
	const replaced = () => replaceCardEvent.mock.calls.at(-1)?.[2] as CardEvent;

	it('a click on a waiting line drops the holder to 0 HP and keeps what it took', async () => {
		await zero.actOnZeroHp(card, zeroLine('waiting'));

		expect(tessa.system.attributes.hp.value).toBe(0);
		expect(replaceCardEvent).toHaveBeenCalledWith(card, 'zeroHp.line', expect.anything());
		expect(replaced().action).toMatchObject({ state: 'dropped', hpLost: 14 });
	});

	it('Undo gives back the HP the line took, up to the max HP, and is not healing', async () => {
		tessa.system.attributes.hp.value = 10;

		await zero.actOnZeroHp(card, zeroLine('dropped', { hpLost: 14 }));

		expect(tessa.update).toHaveBeenCalledWith(
			{ 'system.attributes.hp.value': 20 },
			{ nimble: { undoesDamage: true } },
		);
		expect(replaced().action).toMatchObject({ state: 'undone' });
	});

	it('an undone line does nothing', async () => {
		await expect(zero.actOnZeroHp(card, zeroLine('undone'))).resolves.toBe(false);
		expect(tessa.update).not.toHaveBeenCalled();
	});

	it('the owner of the holder or a GM may act on it', () => {
		const action = zeroLine('waiting').action as ZeroHpAction;
		expect(zero.canActOnZeroHp(action)).toBe(true);
	});
});
