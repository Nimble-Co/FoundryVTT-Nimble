import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, TurnDamageAction } from '#types/cardEvent.d.ts';

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const requestSaves = vi.fn(async (..._args: unknown[]) => {});
const fireEvent = vi.fn();

let line: typeof import('../turnDamageLine.js');

function hero() {
	const actor = {
		uuid: 'Actor.tessa',
		name: 'Tessa',
		isOwner: true,
		system: {
			attributes: { hp: { value: 20, temp: 3, max: 20 }, wounds: { value: 1, max: 6 } },
		},
		applyDamage: vi.fn(async (amount: number) => {
			const hp = actor.system.attributes.hp;
			const fromTemp = Math.min(hp.temp, amount);
			hp.temp -= fromTemp;
			hp.value = Math.max(0, hp.value - (amount - fromTemp));
		}),
		update: vi.fn(async (data: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(data)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

let tessa: ReturnType<typeof hero>;
const card = { id: 'turn-card' };

function damageLine(state: TurnDamageAction['state'], fields: Partial<TurnDamageAction> = {}) {
	const action: TurnDamageAction = {
		kind: 'turnDamage',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		amount: 7,
		damageType: 'fire',
		wounds: 1,
		sourceUuid: null,
		state,
		...fields,
	};
	return {
		id: 'turnDamage.line',
		kind: 'damage',
		icon: 'fa-solid fa-fire',
		text: { key: 'x' },
		cause: { key: 'NIMBLE.chat.turnDamage.causeNoFormula', data: { source: 'Cauldron' } },
		action,
		at: 1,
	} as CardEvent;
}

const replaced = () => replaceCardEvent.mock.calls.at(-1)?.[2] as CardEvent;

beforeEach(async () => {
	replaceCardEvent.mockClear();
	requestSaves.mockClear();
	fireEvent.mockClear();
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		replaceCardEvent,
	}));
	vi.doMock('#utils/saveRequest/saveRequests.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		requestSaves,
	}));
	vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		fireEvent,
	}));
	line = await import('../turnDamageLine.js');
	vi.doUnmock('#utils/chat/cardEvents.js');
	vi.doUnmock('#utils/saveRequest/saveRequests.js');
	vi.doUnmock('#utils/lastsUntil/lastsUntilEvents.js');
	tessa = hero();
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === tessa.uuid ? tessa : null)),
	);
	(globalThis as unknown as { game: { user: unknown } }).game.user = { id: 'p', isGM: false };
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('takeTurnDamage', () => {
	it('deals a waiting line: temp HP first, then HP, and the Wounds; then the saves of the damage', async () => {
		await line.takeTurnDamage(card, damageLine('waiting'));

		expect(tessa.system.attributes.hp).toMatchObject({ value: 16, temp: 0 });
		expect(tessa.system.attributes.wounds.value).toBe(2);
		expect(fireEvent).toHaveBeenCalledWith(
			'takeDamage',
			tessa,
			{ damageTypes: ['fire'] },
			{ id: 'turn-card' },
		);
		expect(requestSaves).toHaveBeenCalledWith(card, tessa, 'takeDamage');
		expect(replaced().action).toMatchObject({
			state: 'dealt',
			hpLost: 4,
			tempLost: 3,
			woundsGained: 1,
		});
	});

	it('marks the line dealt before it deals, so a second click finds no Take', async () => {
		await line.takeTurnDamage(card, damageLine('waiting'));

		expect(replaceCardEvent.mock.calls[0][2]).toMatchObject({ action: { state: 'dealt' } });
		expect(replaceCardEvent.mock.invocationCallOrder[0]).toBeLessThan(
			tessa.applyDamage.mock.invocationCallOrder[0],
		);
	});

	it('deals nothing when the line cannot be marked dealt', async () => {
		replaceCardEvent.mockImplementationOnce(async () => false);

		expect(await line.takeTurnDamage(card, damageLine('waiting'))).toBe(false);

		expect(tessa.applyDamage).not.toHaveBeenCalled();
		expect(requestSaves).not.toHaveBeenCalled();
	});

	it('a dealing error puts the line back to waiting', async () => {
		tessa.applyDamage.mockRejectedValueOnce(new Error('no write'));
		const waiting = damageLine('waiting');

		await expect(line.takeTurnDamage(card, waiting)).rejects.toThrow('no write');

		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, waiting.id, waiting);
	});

	it('does nothing for a line that is dealt already', async () => {
		expect(await line.takeTurnDamage(card, damageLine('dealt'))).toBe(false);
		expect(tessa.applyDamage).not.toHaveBeenCalled();
	});
});

describe('undoTurnDamage', () => {
	it('gives back the HP, the temp HP and the Wounds the line took, and marks it undone', async () => {
		tessa.system.attributes.hp = { value: 16, temp: 0, max: 20 };
		tessa.system.attributes.wounds.value = 2;

		await line.undoTurnDamage(
			card,
			damageLine('dealt', { hpLost: 4, tempLost: 3, woundsGained: 1 }),
		);

		expect(tessa.system.attributes.hp).toMatchObject({ value: 20, temp: 3 });
		expect(tessa.update).toHaveBeenCalledWith(
			{ 'system.attributes.hp.value': 20, 'system.attributes.hp.temp': 3 },
			{ nimble: { undoesDamage: true } },
		);
		expect(tessa.system.attributes.wounds.value).toBe(1);
		expect(replaced().action).toMatchObject({ state: 'undone' });
	});

	it('gives back no HP above the max, and an undone line gives back nothing again', async () => {
		tessa.system.attributes.hp = { value: 18, temp: 0, max: 20 };

		await line.undoTurnDamage(card, damageLine('dealt', { hpLost: 7, tempLost: 0 }));
		expect(tessa.system.attributes.hp.value).toBe(20);

		tessa.update.mockClear();
		expect(await line.undoTurnDamage(card, damageLine('undone', { hpLost: 7 }))).toBe(false);
		expect(tessa.update).not.toHaveBeenCalled();
	});
});

describe('canActOnTurnDamage', () => {
	it('lets the owner of the creature that took it, or a GM, act on the line', () => {
		const action = damageLine('dealt').action as TurnDamageAction;
		expect(line.canActOnTurnDamage(action)).toBe(true);

		tessa.isOwner = false;
		expect(line.canActOnTurnDamage(action)).toBe(false);

		(globalThis as unknown as { game: { user: unknown } }).game.user = { id: 'gm', isGM: true };
		expect(line.canActOnTurnDamage(action)).toBe(true);
	});
});
