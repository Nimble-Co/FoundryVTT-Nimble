import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apply = vi.fn(async () => null);
const globals = globalThis as unknown as Record<string, any>;

async function load() {
	vi.resetModules();
	vi.doMock('../../actor/applyConditionToActor.js', () => ({ default: apply }));
	return import('../hitCondition.js');
}

const rule = (overrides: Record<string, unknown>) => ({
	type: 'hitCondition',
	item: { id: 'bite' },
	test: () => true,
	condition: 'held',
	when: 'hit',
	recipient: 'target',
	...overrides,
});
const attacker = (...rules: unknown[]) => ({
	uuid: 'Actor.m',
	rules,
	setFlag: vi.fn(async () => undefined),
});
const victim = { uuid: 'Actor.h', name: 'Dagr' };

const input = (over: Record<string, unknown>) =>
	({
		item: { id: 'bite' },
		hurt: [victim],
		isCritical: false,
		isMiss: false,
		...over,
	}) as never;

describe('applyHitConditions', () => {
	let featureEffects: boolean;

	beforeEach(() => {
		featureEffects = true;
		apply.mockClear();
		globals.game.settings = { get: () => featureEffects };
	});

	afterEach(() => {
		delete globals.game.settings;
		vi.doUnmock('../../actor/applyConditionToActor.js');
	});

	it('gives the target the condition on a hit', async () => {
		const { applyHitConditions } = await load();
		await applyHitConditions(input({ attacker: attacker(rule({})) }));
		expect(apply).toHaveBeenCalledWith(victim, 'held', expect.anything());
	});

	it('waits for a crit when the rule asks', async () => {
		const { applyHitConditions } = await load();
		const crit = attacker(rule({ when: 'crit' }));
		await applyHitConditions(input({ attacker: crit }));
		expect(apply).not.toHaveBeenCalled();
		await applyHitConditions(input({ attacker: crit, isCritical: true }));
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('does nothing on a miss, or for another item', async () => {
		const { applyHitConditions } = await load();
		await applyHitConditions(input({ attacker: attacker(rule({})), isMiss: true }));
		await applyHitConditions(input({ attacker: attacker(rule({})), item: { id: 'other' } }));
		expect(apply).not.toHaveBeenCalled();
	});

	it('gives the attacker the condition and stores the creature', async () => {
		const { applyHitConditions } = await load();
		const self = attacker(rule({ recipient: 'self' }));
		await applyHitConditions(input({ attacker: self }));
		expect(apply).toHaveBeenCalledWith(self, 'held', expect.anything());
		expect(self.setFlag).toHaveBeenCalledWith('nimble', 'heldCreature', {
			uuid: 'Actor.h',
			name: 'Dagr',
		});
	});

	it('with Feature Effects off, applies nothing but still stores the creature', async () => {
		featureEffects = false;
		const { applyHitConditions } = await load();
		const self = attacker(rule({ recipient: 'self' }));
		await applyHitConditions(input({ attacker: self }));
		expect(apply).not.toHaveBeenCalled();
		expect(self.setFlag).toHaveBeenCalled();
	});

	it('reads the creature of a Latched target only', async () => {
		const { latchedCreatureOf } = await load();
		const getFlag = () => ({ uuid: 'Actor.h', name: 'Dagr' });
		expect(latchedCreatureOf({ statuses: new Set(['latched']), getFlag } as never)).toEqual({
			uuid: 'Actor.h',
			name: 'Dagr',
		});
		expect(latchedCreatureOf({ statuses: new Set(), getFlag } as never)).toBeNull();
	});
});
