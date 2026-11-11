import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import {
	freeUseEvent,
	freeUseSink,
	useCardHasSomethingToClick,
	useResults,
} from '../freeUseFold.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const node = (fields: Record<string, unknown>) =>
	({ id: String(fields.type), parentNode: null, parentContext: null, ...fields }) as EffectNode;

const reason = {
	key: 'NIMBLE.rules.useItemFree.cardLine',
	data: { trigger: { key: 'NIMBLE.rules.useItemFree.reasons.onCritReceived' }, feature: 'Fury' },
};

describe('useCardHasSomethingToClick', () => {
	it('is false for self effects, pool steps and notes', () => {
		const effects = [
			node({ type: 'applyEffect', recipient: 'self' }),
			node({ type: 'pool', poolType: 'dice', action: 'rollDie' }),
			node({ type: 'note', text: 'x' }),
		];
		expect(useCardHasSomethingToClick({ targets: [], activation: { effects } })).toBe(false);
	});

	it.each([
		['damage', { type: 'damage', formula: '1' }],
		['save', { type: 'savingThrow' }],
		['healing', { type: 'healing' }],
		['move', { type: 'move' }],
		['effect for targets', { type: 'applyEffect', recipient: 'targets' }],
	])('is true with a %s step', (_name, fields) => {
		expect(useCardHasSomethingToClick({ activation: { effects: [node(fields)] } })).toBe(true);
	});

	it('is true with a target or an area to place', () => {
		expect(useCardHasSomethingToClick({ targets: ['Token.t'] })).toBe(true);
		expect(
			useCardHasSomethingToClick({
				activation: { acquireTargetsFromTemplate: true, template: { shape: 'circle' } },
			}),
		).toBe(true);
	});
});

describe('freeUseEvent', () => {
	it('is one line: who used what for free, why, and the pools it changed', () => {
		const pool = node({
			type: 'pool',
			poolType: 'dice',
			poolIdentifier: 'fury',
			result: { applied: true, poolLabel: 'Fury Dice', faces: [3, 4] },
		});
		const event = freeUseEvent({
			actorName: 'Hero',
			item: { name: 'Rage', img: 'rage.webp' },
			reason,
			effects: [pool],
		});
		expect(event).toMatchObject({
			kind: 'freeUse',
			img: 'rage.webp',
			text: { key: 'NIMBLE.chat.events.freeUse.text', data: { name: 'Hero', item: 'Rage' } },
			cause: {
				key: 'NIMBLE.chat.events.freeUse.causeWithResults',
				data: {
					cause: {
						key: 'NIMBLE.chat.events.freeUse.cause',
						data: { trigger: reason.data.trigger, feature: 'Fury' },
					},
					results: {
						key: 'NIMBLE.chat.events.freeUse.poolNow',
						data: { pool: 'Fury Dice', value: '3, 4' },
					},
				},
			},
		});
	});

	it('has only the reason when no pool changed', () => {
		const event = freeUseEvent({ actorName: 'Hero', item: { name: 'Rage' }, reason, effects: [] });
		expect(event.cause?.key).toBe('NIMBLE.chat.events.freeUse.cause');
		expect(event.icon).toBe('fa-solid fa-forward');
		expect(useResults([])).toBeNull();
	});
});

describe('freeUseSink', () => {
	let previous: Record<string, unknown>;

	beforeEach(() => {
		previous = { messages: globals.game.messages, users: globals.game.users };
	});

	afterEach(() => {
		Object.assign(globals.game, previous);
	});

	it('is null when the host card is gone or cannot show a GM line', () => {
		const card = { id: 'host', whisper: [] as string[], update: vi.fn() };
		globals.game.messages = { get: (id: string) => (id === 'host' ? card : undefined) };
		expect(freeUseSink({ cardId: 'missing' }, { gmOnly: false })).toBeNull();
		expect(freeUseSink({ cardId: 'host' }, { gmOnly: true })).toBeNull();
		expect(freeUseSink({ cardId: 'host' }, { gmOnly: false })).toBeTypeOf('function');
	});
});
