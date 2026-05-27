import { beforeAll, describe, expect, it } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

// _populateDerivedTags calls getAdjacencySyncEnabled() which reads
// game.settings.settings.has(...). The default test mock doesn't include
// settings, so we install a minimal stub that reports the setting as missing
// (causing getAdjacencySyncEnabled to early-return false).
beforeAll(() => {
	const gameStub = globalThis as { game?: { settings?: { settings?: Map<string, unknown> } } };
	if (gameStub.game && !gameStub.game.settings) {
		gameStub.game.settings = { settings: new Map() };
	}
});

interface ActorStub {
	statuses: Set<string>;
	system: { attributes: { hp: { value: number; max: number } } };
	tags: Set<string>;
}

function makeStub({
	statuses = [],
	hp = 10,
	hpMax = 10,
}: {
	statuses?: string[];
	hp?: number;
	hpMax?: number;
} = {}): ActorStub {
	return {
		statuses: new Set(statuses),
		system: { attributes: { hp: { value: hp, max: hpMax } } },
		tags: new Set<string>(),
	};
}

function runPopulate(stub: ActorStub): Set<string> {
	const fn = NimbleBaseActor.prototype._populateDerivedTags;
	fn.call(stub as unknown as InstanceType<typeof NimbleBaseActor>);
	return stub.tags;
}

describe('_populateDerivedTags — self / target state tags', () => {
	describe('bloodied detection', () => {
		it('adds self:bloodied and target:bloodied when bloodied status is active', () => {
			const tags = runPopulate(makeStub({ statuses: ['bloodied'], hp: 10, hpMax: 10 }));
			expect(tags.has('self:bloodied')).toBe(true);
			expect(tags.has('target:bloodied')).toBe(true);
		});

		it('adds bloodied via HP failsafe when status is missing but HP <= 50%', () => {
			const tags = runPopulate(makeStub({ statuses: [], hp: 5, hpMax: 10 }));
			expect(tags.has('self:bloodied')).toBe(true);
			expect(tags.has('target:bloodied')).toBe(true);
		});

		it('does not add bloodied when HP is above 50% and status is missing', () => {
			const tags = runPopulate(makeStub({ statuses: [], hp: 6, hpMax: 10 }));
			expect(tags.has('self:bloodied')).toBe(false);
			expect(tags.has('target:bloodied')).toBe(false);
		});

		it('does not add bloodied when HP is 0 (failsafe requires hp > 0 so dying actors are excluded)', () => {
			const tags = runPopulate(makeStub({ statuses: [], hp: 0, hpMax: 10 }));
			expect(tags.has('self:bloodied')).toBe(false);
		});
	});

	describe('dying / bloodied mutual exclusion (#579)', () => {
		it('adds self:dying and suppresses bloodied when dying status is active', () => {
			// Both bloodied and dying statuses set — dying takes precedence
			const tags = runPopulate(makeStub({ statuses: ['dying', 'bloodied'], hp: 0, hpMax: 10 }));
			expect(tags.has('self:dying')).toBe(true);
			expect(tags.has('self:bloodied')).toBe(false);
			expect(tags.has('target:bloodied')).toBe(false);
		});

		it('suppresses bloodied via dying even when HP failsafe would otherwise fire', () => {
			// Dying actor with HP at 50% (e.g. wound recovery edge case) — still not bloodied
			const tags = runPopulate(makeStub({ statuses: ['dying'], hp: 5, hpMax: 10 }));
			expect(tags.has('self:dying')).toBe(true);
			expect(tags.has('self:bloodied')).toBe(false);
		});

		it('does not add self:dying when status is missing', () => {
			const tags = runPopulate(makeStub({ statuses: [], hp: 0, hpMax: 10 }));
			expect(tags.has('self:dying')).toBe(false);
		});
	});

	describe('lastStand — coexists with bloodied (intentional)', () => {
		it('adds self:lastStand and self:bloodied when both statuses are active', () => {
			// lastStand monsters are still at low HP; gating on target:bloodied should hit
			const tags = runPopulate(
				makeStub({ statuses: ['lastStand', 'bloodied'], hp: 50, hpMax: 200 }),
			);
			expect(tags.has('self:lastStand')).toBe(true);
			expect(tags.has('self:bloodied')).toBe(true);
			expect(tags.has('target:bloodied')).toBe(true);
		});

		it('adds self:lastStand without bloodied when status is set but HP is full', () => {
			// Unusual but possible during phase-transition setup
			const tags = runPopulate(makeStub({ statuses: ['lastStand'], hp: 200, hpMax: 200 }));
			expect(tags.has('self:lastStand')).toBe(true);
			expect(tags.has('self:bloodied')).toBe(false);
		});
	});

	describe('concentrating', () => {
		it('adds both self: and target: concentrating tags', () => {
			const tags = runPopulate(makeStub({ statuses: ['concentration'], hp: 10, hpMax: 10 }));
			expect(tags.has('self:concentrating')).toBe(true);
			expect(tags.has('target:concentrating')).toBe(true);
		});

		it('does not add concentrating tags when status is missing', () => {
			const tags = runPopulate(makeStub({ statuses: [], hp: 10, hpMax: 10 }));
			expect(tags.has('self:concentrating')).toBe(false);
			expect(tags.has('target:concentrating')).toBe(false);
		});
	});

	describe('combined states', () => {
		it('a bloodied + concentrating actor gets all four tags', () => {
			const tags = runPopulate(
				makeStub({ statuses: ['bloodied', 'concentration'], hp: 5, hpMax: 10 }),
			);
			expect(tags.has('self:bloodied')).toBe(true);
			expect(tags.has('target:bloodied')).toBe(true);
			expect(tags.has('self:concentrating')).toBe(true);
			expect(tags.has('target:concentrating')).toBe(true);
		});

		it('a dying + concentrating actor keeps dying and concentrating but not bloodied', () => {
			// Dying suppresses bloodied; concentration is independent
			const tags = runPopulate(
				makeStub({ statuses: ['dying', 'bloodied', 'concentration'], hp: 0, hpMax: 10 }),
			);
			expect(tags.has('self:dying')).toBe(true);
			expect(tags.has('self:bloodied')).toBe(false);
			expect(tags.has('self:concentrating')).toBe(true);
			expect(tags.has('target:concentrating')).toBe(true);
		});
	});
});
