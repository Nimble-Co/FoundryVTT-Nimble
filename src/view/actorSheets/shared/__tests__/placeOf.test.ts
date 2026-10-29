import { describe, expect, it } from 'vitest';
import { heroItem } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { placeOf } from '../placeOf.ts';
import type { ItemLike, RuleLike } from '../sheetSource.ts';

const rule = (type: string, fields: Record<string, unknown> = {}): RuleLike => ({
	id: `${type}Rule`,
	type,
	active: true,
	fields,
});

const feature = (
	cost: { type?: string; quantity?: number; isReaction?: boolean } = {},
	rules: RuleLike[] = [],
): ItemLike =>
	heroItem({
		type: 'feature',
		system: { activation: { cost: { type: 'none', quantity: 1, isReaction: false, ...cost } } },
		rules,
	});

describe('placeOf', () => {
	it('puts a feature with an action cost on Actions, with any quantity', () => {
		expect(placeOf(feature({ type: 'action', quantity: 1 }))).toBe('action');
		expect(placeOf(feature({ type: 'action', quantity: 0 }))).toBe('action');
		expect(placeOf(feature({ type: 'action', quantity: 2 }))).toBe('action');
	});

	it('puts a feature that spends charges or dice by hand on Actions', () => {
		expect(placeOf(feature({}, [rule('chargeConsumer')]))).toBe('action');
		expect(placeOf(feature({}, [rule('diceConsumer', { mode: 'manual' })]))).toBe('action');
	});

	it('keeps a feature whose dice consumer spends by itself passive', () => {
		expect(placeOf(feature({}, [rule('diceConsumer', { mode: 'autoBonus' })]))).toBe('passive');
	});

	it('puts a feature that you turn on, or that marks a target, on Actions', () => {
		expect(placeOf(feature({}, [rule('toggleEffect')]))).toBe('action');
		expect(placeOf(feature({}, [rule('markTarget')]))).toBe('action');
	});

	it('ignores a disabled rule', () => {
		expect(placeOf(feature({}, [rule('toggleEffect', { disabled: true })]))).toBe('passive');
	});

	it('puts a reaction in Reactions, also the legacy reaction cost type', () => {
		expect(placeOf(feature({ type: 'action', isReaction: true }))).toBe('reaction');
		expect(placeOf(feature({ type: 'reaction' }))).toBe('reaction');
	});

	it('does not make a feature a reaction because it changes an incoming attack', () => {
		expect(placeOf(feature({}, [rule('modifyIncomingAttack')]))).toBe('passive');
	});

	it('keeps a feature with no cost and no rules passive', () => {
		expect(placeOf(feature())).toBe('passive');
		expect(placeOf(heroItem({ type: 'feature' }))).toBe('passive');
	});
});
