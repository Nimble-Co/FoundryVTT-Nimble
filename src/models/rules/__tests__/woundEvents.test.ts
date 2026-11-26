import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import type { PendingWoundView } from '../../../utils/wounds/pendingWound.js';
import { NimbleBaseRule } from '../base.js';
import { PendingWoundRule } from '../pendingWound.js';
import { SafeRestWoundsRule } from '../safeRestWounds.js';
import { WouldDropToZeroRule } from '../wouldDropToZero.js';
import { WoundImmunityRule } from '../woundImmunity.js';

function ownFields(Rule: { defineSchema: () => object }) {
	return Object.keys(Rule.defineSchema()).filter(
		(name) => !(name in NimbleBaseRule.defineSchema()),
	);
}

function withActor<T>(
	rule: T,
	actor: object = { getRollData: () => ({}), getDomain: () => [] },
): T {
	const item = { isEmbedded: true, actor, name: 'Feature', uuid: 'item', getDomain: () => [] };
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
	return rule;
}

function view(extra: Partial<PendingWoundView> = {}): PendingWoundView {
	return {
		amount: 2,
		requested: 2,
		negated: 0,
		cause: 'direct',
		critical: false,
		wounds: { value: 1, max: 6 },
		headroom: 5,
		reachesLastWound: false,
		source: { uuid: 'Actor.Villain', name: 'Villain' },
		...extra,
	};
}

function fieldInitial(schema: object, name: string): unknown {
	return (schema as Record<string, { initial?: unknown }>)[name]?.initial;
}

describe('wound event rules', () => {
	it('registers each rule where the builder can find it', () => {
		expect(RULE_CLASSES.pendingWound).toBe(PendingWoundRule);
		expect(RULE_CLASSES.wouldDropToZero).toBe(WouldDropToZeroRule);
		expect(RULE_CLASSES.woundImmunity).toBe(WoundImmunityRule);
		expect(RULE_CLASSES.safeRestWounds).toBe(SafeRestWoundsRule);
		expect(PendingWoundRule.group).toBe('triggers');
		expect(WouldDropToZeroRule.group).toBe('triggers');
		expect(WoundImmunityRule.group).toBe('conditions');
		expect(SafeRestWoundsRule.group).toBe('resource');
		expect(CONFIG.NIMBLE.ruleTypes.pendingWound).toBe('Pending Wound');
		expect(CONFIG.NIMBLE.ruleTypes.wouldDropToZero).toBe('Would Drop to 0 HP');
		expect(CONFIG.NIMBLE.ruleTypes.woundImmunity).toBe('Wound Immunity');
		expect(CONFIG.NIMBLE.ruleTypes.safeRestWounds).toBe('Safe Rest Wounds');
	});

	it('gives Wound Immunity no fields but its type', () => {
		expect(ownFields(WoundImmunityRule)).toEqual(['type']);
		expect(WoundImmunityRule.description).toBe('NIMBLE.rules.woundImmunity.description');
	});

	it('stops, lowers, sets, or redirects from what the rule says', () => {
		const schema = PendingWoundRule.defineSchema();
		expect(fieldInitial(schema, 'change')).toBe('negate');
		expect(fieldInitial(schema, 'amount')).toBe('');
		expect(fieldInitial(schema, 'choice')).toBe('automatic');

		const rule = withActor(
			new PendingWoundRule({ type: 'pendingWound' } as never, { strict: false } as never),
		);
		Object.assign(rule, {
			change: 'negate',
			amount: '',
			whenAmount: 0,
			cause: 'any',
			critical: 'any',
			onlyLastWound: false,
			disabled: false,
		});
		expect(rule.planPending(view()).take).toBe(Number.POSITIVE_INFINITY);

		rule.change = 'lower';
		expect(rule.planPending(view()).take).toBe(0);
		rule.change = 'set';
		expect(rule.planPending(view()).take).toBe(0);

		rule.amount = '1';
		rule.whenAmount = 2;
		rule.critical = 'only';
		expect(rule.planPending(view()).take).toBe(1);
		expect(rule.matchesPending(view())).toBe(false);
		expect(rule.matchesPending(view({ critical: true }))).toBe(true);
		expect(rule.matchesPending(view({ critical: true, amount: 3 }))).toBe(false);
		expect(rule.matchesPending(view({ critical: true, cause: 'dropToZero' }))).toBe(true);

		rule.cause = 'dropToZero';
		expect(rule.matchesPending(view({ critical: true }))).toBe(false);
		rule.onlyLastWound = true;
		rule.cause = 'any';
		rule.critical = 'any';
		rule.whenAmount = 0;
		expect(rule.matchesPending(view({ reachesLastWound: true, amount: 2 }))).toBe(true);
		expect(rule.matchesPending(view())).toBe(false);
	});

	it('reads a drop as taking no damage, or as staying at 1 HP', () => {
		const schema = WouldDropToZeroRule.defineSchema();
		expect(fieldInitial(schema, 'response')).toBe('prevent');
		expect(fieldInitial(schema, 'choice')).toBe('automatic');
		expect(fieldInitial(schema, 'onlyAttack')).toBe(false);
		expect(fieldInitial(schema, 'chargePoolIdentifier')).toBe('');
		expect(fieldInitial(schema, 'moveDirection')).toBe('any');

		const rule = withActor(
			new WouldDropToZeroRule({ type: 'wouldDropToZero' } as never, { strict: false } as never),
		);
		Object.assign(rule, {
			response: 'prevent',
			woundInstead: '',
			moveDistance: '',
			disabled: false,
		});
		expect(rule.planDrop()).toEqual({
			response: 'prevent',
			woundInstead: 0,
			moveDistance: 0,
			moveDirection: 'any',
		});

		rule.response = 'floor';
		rule.woundInstead = '1';
		rule.moveDistance = '6';
		rule.moveDirection = 'away';
		expect(rule.planDrop()).toEqual({
			response: 'floor',
			woundInstead: 1,
			moveDistance: 6,
			moveDirection: 'away',
		});
		expect(rule.matchesDrop()).toBe(true);
		rule.onlyAttack = true;
		expect(rule.matchesDrop()).toBe(false);
		expect(rule.matchesDrop({ attack: true })).toBe(true);
		rule.onlyAttack = false;
	});

	it('reads @speed in a move distance as the walk speed of the creature who moves', () => {
		const mover = { system: { attributes: { movement: { walk: 7 } } } };
		const holder = {
			getRollData: () => ({ speed: 99 }),
			getDomain: () => [],
			system: { attributes: { movement: { walk: 3 } } },
		};
		const drop = withActor(
			new WouldDropToZeroRule({ type: 'wouldDropToZero' } as never, { strict: false } as never),
			holder,
		);
		Object.assign(drop, { response: 'prevent', woundInstead: '', moveDistance: '@speed' });
		expect(drop.planDrop(mover).moveDistance).toBe(7);

		const pending = withActor(
			new PendingWoundRule({ type: 'pendingWound' } as never, { strict: false } as never),
		);
		Object.assign(pending, { change: 'negate', amount: '', moveDistance: '@speed + 1' });
		expect(pending.planPending(view(), mover).moveDistance).toBe(8);
	});

	it('changes the 1 Wound a safe rest heals, and leaves that 1 alone when the amount is 0', () => {
		const schema = SafeRestWoundsRule.defineSchema();
		expect(fieldInitial(schema, 'mode')).toBe('add');
		expect(fieldInitial(schema, 'value')).toBe('0');

		const rule = withActor(
			new SafeRestWoundsRule({ type: 'safeRestWounds' } as never, { strict: false } as never),
		);
		Object.assign(rule, { mode: 'add', value: '0', disabled: false });
		expect(rule.healOnSafeRest(1, 4)).toBe(1);

		rule.mode = 'multiply';
		rule.value = '2';
		expect(rule.healOnSafeRest(1, 4)).toBe(2);
		rule.mode = 'replace';
		rule.value = '3';
		expect(rule.healOnSafeRest(1, 4)).toBe(3);
		rule.mode = 'all';
		expect(rule.healOnSafeRest(1, 4)).toBe(4);
	});
});
