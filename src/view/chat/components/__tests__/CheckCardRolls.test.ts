import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CheckCardRolls from '../CheckCardRolls.svelte';

function saveCard(d20: number, total: number, dc: number | null | undefined) {
	const message = {
		id: 'check-card-rolls',
		type: 'savingThrow',
		system: {
			saveKey: 'strength',
			actorType: 'npc',
			permissions: 0,
			rollMode: 0,
			incomingReactions: [],
			rerolls: [],
			...(dc === undefined ? {} : { dc }),
		},
		rolls: [{ total, terms: [{ faces: 20, results: [{ result: d20, active: true }] }] }],
		reactive: null as unknown,
	};
	message.reactive = message;
	return message as never;
}

function resultLabel(messageDocument: never): string | null {
	const { container } = render(CheckCardRolls, { messageDocument, label: 'Strength Save' });
	return container.querySelector('.roll__result')?.textContent?.trim() ?? null;
}

type Globals = { game: { settings: unknown }; Roll: { fromData: unknown } };
const globals = globalThis as unknown as Globals;
let previousSettings: unknown;
let previousFromData: unknown;

beforeEach(() => {
	// RollSummary reads the auto-expand setting, and the roll tooltip reads `roll.dice`.
	previousSettings = globals.game.settings;
	previousFromData = globals.Roll.fromData;
	globals.game.settings = { get: () => false };
	globals.Roll.fromData = (data: Record<string, unknown>) => ({ ...data, dice: [] });
});

afterEach(() => {
	globals.game.settings = previousSettings;
	globals.Roll.fromData = previousFromData;
});

describe('CheckCardRolls', () => {
	it('names the DC when the card has one', () => {
		expect(resultLabel(saveCard(5, 8, 14))).toBe('Failed - DC 14');
		expect(resultLabel(saveCard(15, 18, 14))).toBe('Succeeded - DC 14');
	});

	it('tells only the result with no DC', () => {
		expect(resultLabel(saveCard(1, 4, null))).toBe('Failed');
		expect(resultLabel(saveCard(20, 23, undefined))).toBe('Succeeded');
	});
});
