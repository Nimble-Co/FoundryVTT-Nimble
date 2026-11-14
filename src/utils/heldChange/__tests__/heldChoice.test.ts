import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heldRollEffect } from '../../../../tests/fixtures/heldRollEffect.js';
import { heldChangeKey } from '../heldChange.js';
import { heldChosenOf, keptAmountOfRoll } from '../heldChoice.js';

const MIRA = 'Actor.mira';

const attacker = {
	uuid: MIRA,
	isOwner: true,
	effects: [
		heldRollEffect('rampage', {
			origin: MIRA,
			kind: 'wholeAmount',
			value: 13,
			label: 'Rampage',
			whichRoll: 'holderAttacks',
		}),
	],
};

const attack = (activation: Record<string, unknown> = {}) => ({
	system: {
		activation: {
			effects: [{ type: 'damage', canCrit: true, canMiss: true }],
			targets: { attackType: 'reach' },
			...activation,
		},
	},
});
const area = attack({ acquireTargetsFromTemplate: true, template: { shape: 'circle' } });

const globals = globalThis as unknown as Record<string, unknown>;
let saved: unknown;

beforeEach(() => {
	saved = globals.fromUuidSync;
	globals.fromUuidSync = vi.fn((uuid: string) =>
		uuid === MIRA ? { uuid: MIRA, name: 'Mira', documentName: 'Actor' } : null,
	);
});

afterEach(() => {
	globals.fromUuidSync = saved;
});

describe('keptAmountOfRoll with Feature Effects on', () => {
	const on = { chosen: null };

	it('uses and ends the kept amount unless the player unticks it', () => {
		const used = keptAmountOfRoll(attacker, attack(), on);
		expect(used.kept?.value).toBe(13);
		expect(used.toEnd).toBe(used.kept);

		const unticked = keptAmountOfRoll(attacker, attack(), { ...on, tick: false });
		expect(unticked.kept).toBeNull();
		expect(unticked.toEnd?.value).toBe(13);
	});

	it('an area attack ends it without using it', () => {
		const { kept, toEnd } = keptAmountOfRoll(attacker, area, on);
		expect(kept).toBeNull();
		expect(toEnd?.value).toBe(13);
	});
});

describe('keptAmountOfRoll with Feature Effects off', () => {
	it('an unticked kept amount neither applies nor ends', () => {
		expect(keptAmountOfRoll(attacker, attack(), { chosen: new Set() })).toEqual({
			kept: null,
			toEnd: null,
		});
	});

	it('a ticked kept amount applies and ends', () => {
		const { kept, toEnd } = keptAmountOfRoll(attacker, attack(), {
			tick: true,
			chosen: new Set(),
		});
		expect(kept?.value).toBe(13);
		expect(toEnd).toBe(kept);
	});

	it('an area attack ends it only when its line is ticked', () => {
		expect(keptAmountOfRoll(attacker, area, { chosen: new Set() }).toEnd).toBeNull();

		const ended = keptAmountOfRoll(attacker, area, { chosen: null }).toEnd;
		const ticked = keptAmountOfRoll(attacker, area, {
			chosen: new Set([heldChangeKey(ended as never)]),
		});
		expect(ticked.kept).toBeNull();
		expect(ticked.toEnd?.value).toBe(13);
	});
});

describe('heldChosenOf', () => {
	const game = (globalThis as unknown as { game: Record<string, unknown> }).game;
	afterEach(() => {
		delete game.settings;
	});

	it('is null with Feature Effects on, so every change applies', () => {
		game.settings = { get: () => true };
		expect(heldChosenOf(['a'])).toBeNull();
	});

	it('with Feature Effects off, holds what was ticked, and nothing with no window', () => {
		game.settings = { get: () => false };
		expect(heldChosenOf(['a'])).toEqual(new Set(['a']));
		expect(heldChosenOf()).toEqual(new Set());
	});
});
