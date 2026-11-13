import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRecoveryTriggersToPools } from '../helpers.js';
import { recoveryDomainOf } from '../itemUseRecovery.js';

const globals = globalThis as unknown as Record<string, any>;

const actor = {
	type: 'character',
	getDomain: () => new Set<string>(),
	getRollData: () => ({}),
	flags: {},
} as never;

function pool(...recoveries: object[]) {
	return {
		thrill: {
			id: 'thrill',
			label: 'Thrill',
			current: 1,
			max: 99,
			recoveries: recoveries.map((each) => ({ mode: 'add', value: '1', ...each })),
		},
	} as never;
}

const gainFrom = (pools: never, triggers: string[], use?: object) =>
	(applyRecoveryTriggersToPools(actor, pools, triggers as never, undefined, use as never) as never)[
		'thrill'
	] as { current: number };

const QUARRY_MELEE = { $and: ['target:quarry', 'attack:melee'] };
const QUARRY_RANGED = { $and: ['target:quarry', 'attack:ranged'] };

describe('a recovery that reads the attack', () => {
	afterEach(() => {
		delete globals.game.settings;
	});

	it('gains on a melee hit on the quarry', () => {
		const pools = pool({ trigger: 'onHit', predicate: QUARRY_MELEE });
		const { current } = gainFrom(pools, ['onHit'], { domain: ['target:quarry', 'attack:melee'] });
		expect(current).toBe(2);
	});

	it('does not gain on a melee hit on another creature, or a ranged hit', () => {
		const pools = pool({ trigger: 'onHit', predicate: QUARRY_MELEE });
		expect(gainFrom(pools, ['onHit'], { domain: ['attack:melee'] }).current).toBe(1);
		expect(gainFrom(pools, ['onHit'], { domain: ['target:quarry', 'attack:ranged'] }).current).toBe(
			1,
		);
	});

	it('gains one charge on a ranged crit on the quarry', () => {
		const pools = pool(
			{ trigger: 'onHit', predicate: QUARRY_MELEE },
			{ trigger: 'onCriticalHit', predicate: QUARRY_RANGED },
		);
		const { current } = gainFrom(pools, ['onHit', 'onCriticalHit'], {
			domain: ['target:quarry', 'attack:ranged'],
		});
		expect(current).toBe(2);
	});

	it('gains one charge on a melee crit on the quarry', () => {
		const pools = pool(
			{ trigger: 'onHit', predicate: QUARRY_MELEE },
			{ trigger: 'onCriticalHit', predicate: QUARRY_RANGED },
		);
		const { current } = gainFrom(pools, ['onHit', 'onCriticalHit'], {
			domain: ['target:quarry', 'attack:melee'],
		});
		expect(current).toBe(2);
	});

	it('gains nothing from a use that spent from this pool (H:757)', () => {
		const pools = pool({ trigger: 'onHit', notWhenSpent: true });
		expect(gainFrom(pools, ['onHit'], { spentPoolIds: new Set(['thrill']) }).current).toBe(1);
		expect(gainFrom(pools, ['onHit'], { spentPoolIds: new Set(['other']) }).current).toBe(2);
	});

	it('gains nothing with Feature Effects off, when the recovery needs them', () => {
		globals.game.settings = { get: vi.fn(() => false) };
		const pools = pool(
			{ trigger: 'onHit', needsFeatureEffects: true },
			{ trigger: 'encounterEnd', mode: 'set', value: '0' },
		);
		expect(gainFrom(pools, ['onHit']).current).toBe(1);
		expect(gainFrom(pools, ['encounterEnd']).current).toBe(0);
	});
});

describe('a recovery on the death of the quarry', () => {
	it('gains for the mark it names, and not for another mark', () => {
		const pools = pool({ trigger: 'onMarkedDeath', predicate: { $and: ['target:quarry'] } });
		expect(gainFrom(pools, ['onMarkedDeath'], { domain: ['target:quarry'] }).current).toBe(2);
		expect(gainFrom(pools, ['onMarkedDeath'], { domain: ['target:other'] }).current).toBe(1);
	});
});

describe('recoveryDomainOf', () => {
	const hunter = {
		getFlag: () => ({ quarry: [{ actorUuid: 'Actor.ogre' }] }),
		flags: { nimble: { toggledEffects: { quarry: [{ actorUuid: 'Actor.ogre' }] } } },
	};

	it('names the target and how the attack reaches it', () => {
		expect(
			recoveryDomainOf(hunter, { targets: { attackType: 'reach' } }, [
				{ actor: { uuid: 'Actor.ogre' } },
			]),
		).toEqual(['target:quarry', 'attack:melee']);
	});

	it('names no mark on another creature', () => {
		expect(
			recoveryDomainOf(hunter, { targets: { attackType: 'range' } }, [
				{ actor: { uuid: 'Actor.wolf' } },
			]),
		).toEqual(['attack:ranged']);
	});
	it('names a monster attack with no attack type melee, and a hero one by no delivery', () => {
		const target = [{ actor: { uuid: 'Actor.wolf' } }];
		expect(
			recoveryDomainOf({ ...hunter, type: 'npc' }, { targets: { attackType: '' } }, target),
		).toEqual(['attack:melee']);
		expect(recoveryDomainOf(hunter, { targets: { attackType: '' } }, target)).toEqual([]);
	});

	describe('with a rule that counts every creature as the quarry for melee attacks', () => {
		const resolve = {
			type: 'countAsMarked',
			markedTagFor: (delivery: string | null) => (delivery === 'melee' ? 'target:quarry' : null),
		};
		const resolute = { ...hunter, rules: [resolve] };

		it('names the mark on any creature for a melee attack', () => {
			expect(
				recoveryDomainOf(resolute, { targets: { attackType: 'reach' } }, [
					{ actor: { uuid: 'Actor.wolf' } },
				]),
			).toEqual(['target:quarry', 'attack:melee']);
		});

		it('names it once on the marked quarry', () => {
			expect(
				recoveryDomainOf(resolute, { targets: { attackType: 'reach' } }, [
					{ actor: { uuid: 'Actor.ogre' } },
				]),
			).toEqual(['target:quarry', 'attack:melee']);
		});

		it('names no mark for a ranged attack', () => {
			expect(
				recoveryDomainOf(resolute, { targets: { attackType: 'range' } }, [
					{ actor: { uuid: 'Actor.wolf' } },
				]),
			).toEqual(['attack:ranged']);
		});
	});
});
