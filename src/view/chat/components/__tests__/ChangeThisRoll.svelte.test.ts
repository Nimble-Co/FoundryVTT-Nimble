import { describe, expect, it, vi } from 'vitest';
import { createChangeThisRollState } from '../ChangeThisRoll.svelte.ts';

let nextId = 0;

function message(system: Record<string, unknown>, total = 7) {
	const card = {
		id: `change-this-roll-${(nextId += 1)}`,
		type: 'savingThrow',
		system: { saveKey: 'strength', ...system },
		rolls: [{ total, terms: [] }],
		reactive: null as unknown,
	};
	card.reactive = card;
	return card as never;
}

function attack(system: Record<string, unknown>) {
	const card = { id: `change-this-roll-${(nextId += 1)}`, type: 'feature', system, rolls: [] };
	return { ...card, reactive: card } as never;
}

function control(card: never, count = 2) {
	return createChangeThisRollState(card, () => ({
		count,
		picking: null,
		opensPicker: vi.fn(() => false),
		useEntry: vi.fn(async () => undefined),
		pickDie: vi.fn(async () => undefined),
		pickValue: vi.fn(async () => undefined),
		pickStat: vi.fn(async () => undefined),
		cancelPick: vi.fn(() => null),
	}));
}

describe('createChangeThisRollState', () => {
	it('counts the rows the user can click', () => {
		expect(control(message({}), 3).count).toBe(3);
	});

	it('opens by itself on a card that says Failed', () => {
		expect(control(message({ dc: 14 }, 7)).open).toBe(true);
	});

	it('opens by itself on an attack that misses', () => {
		expect(control(attack({ isMiss: true })).open).toBe(true);
	});

	it('starts closed on an Initiative card', () => {
		const card = { reactive: { type: 'initiative', system: {}, rolls: [] } } as never;
		expect(control(card).open).toBe(false);
	});

	it('starts closed on a card that says Succeeded', () => {
		expect(control(message({ dc: 14 }, 16)).open).toBe(false);
	});

	it('starts closed on a card with no result', () => {
		expect(control(message({}, 7)).open).toBe(false);
	});

	it('starts closed on an attack that hits, and on a crit', () => {
		expect(control(attack({ isMiss: false })).open).toBe(false);
		expect(control(attack({ isMiss: true, isCritical: true })).open).toBe(false);
	});

	it('does not open with no rows, also on a card that says Failed', () => {
		const empty = control(message({ dc: 14 }, 7), 0);

		expect(empty.count).toBe(0);
		expect(empty.open).toBe(false);
	});

	it("keeps the user's close through a new draw of the card", async () => {
		const card = message({ dc: 14 }, 7);
		await control(card).toggle();

		expect(control(card).open).toBe(false);
	});

	it("keeps the user's open through a new draw of the card", async () => {
		const card = message({ dc: 14 }, 16);
		await control(card).toggle();

		expect(control(card).open).toBe(true);
	});

	it('keeps the state per message', async () => {
		const closed = message({ dc: 14 }, 7);
		await control(closed).toggle();

		expect(control(message({ dc: 14 }, 7)).open).toBe(true);
	});

	it('gives the focus back when a new draw of the card comes into the page', async () => {
		const state = control(message({}));
		const draw = document.createElement('div');
		const toggle = document.createElement('button');
		draw.append(toggle);
		state.elements.anchor = draw;
		state.elements.toggle = toggle;
		state.expectFocusLoss('entry-1');
		const oldRow = document.createElement('button');
		document.body.append(oldRow);
		oldRow.focus();

		state.restoreFocus();
		oldRow.remove();
		document.body.append(draw);
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(document.activeElement).toBe(toggle);
		draw.remove();
	});
});
