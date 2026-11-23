import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chargePools from '#utils/chargePool/chargePoolRecover.js';
import * as poolDice from '../../../hooks/dicePoolTriggers/poolDieToMaxTrigger.js';
import { giveWounds } from '../../actor/giveWounds.js';
import {
	alterPendingWound,
	type PendingWoundPlan,
	type PendingWoundView,
} from '../pendingWound.js';

const recover = vi
	.spyOn(chargePools, 'applyRecoveryToActorIfEligible')
	.mockResolvedValue(undefined);
const raiseDice = vi.spyOn(poolDice, 'raisePoolDiceOnWounds').mockResolvedValue(undefined);

interface Creature {
	uuid: string;
	name: string;
	isOwner: boolean;
	rules: unknown[];
	system: { attributes: { wounds: { value: number; max: number } } };
	update: ReturnType<typeof vi.fn>;
}

function grant(actor: Creature, amount: number, options?: Parameters<typeof giveWounds>[2]) {
	return giveWounds(actor as never, amount, options);
}

function creature(name: string, value = 0, max = 6): Creature {
	const actor: Creature = {
		uuid: `Actor.${name}`,
		name,
		isOwner: true,
		rules: [],
		system: { attributes: { wounds: { value, max } } },
		update: vi.fn(async (data: Record<string, unknown>) => {
			const next = data['system.attributes.wounds.value'];
			if (typeof next === 'number') actor.system.attributes.wounds.value = next;
			return actor;
		}),
	};
	return actor;
}

function plan(
	change: PendingWoundPlan['change'],
	take: number,
	extra: Partial<PendingWoundPlan> = {},
) {
	return {
		change,
		take,
		redirectTo: 'source' as const,
		moveDistance: 0,
		...extra,
	};
}

function pending(next: PendingWoundPlan, extra: Record<string, unknown> = {}) {
	return {
		type: 'pendingWound',
		choice: 'automatic',
		watch: 'self',
		priority: 1,
		label: 'Feature',
		appliesTo: () => true,
		matchesPending: () => true,
		planPending: () => next,
		...extra,
	};
}

beforeEach(() => {
	recover.mockClear();
	raiseDice.mockClear();
});

describe('alterPendingWound', () => {
	it('lands a Wound that no rule changes, and does not observe it', async () => {
		const hero = creature('Hero', 1);

		const record = await grant(hero, 2);

		expect(record).toEqual({ actorName: 'Hero', before: 1, after: 3 });
		expect(recover).not.toHaveBeenCalled();
		expect(raiseDice).not.toHaveBeenCalled();
	});

	it('stops a pending Wound and still observes each one', async () => {
		const hero = creature('Hero', 1);
		hero.rules = [pending(plan('negate', Number.POSITIVE_INFINITY))];

		const record = await grant(hero, 2);

		expect(record).toEqual({ actorName: 'Hero', before: 1, after: 1 });
		expect(hero.update).not.toHaveBeenCalled();
		expect(recover).toHaveBeenCalledTimes(2);
		expect(recover).toHaveBeenCalledWith(hero, 'onWound');
		expect(raiseDice).toHaveBeenCalledTimes(1);
		expect(raiseDice).toHaveBeenCalledWith(hero, 2);
	});

	it('lowers a pending amount without observing the Wounds it takes off', async () => {
		const hero = creature('Hero', 1);
		hero.rules = [pending(plan('lower', 1))];

		const record = await grant(hero, 2);

		expect(record).toEqual({ actorName: 'Hero', before: 1, after: 2 });
		expect(recover).not.toHaveBeenCalled();
		expect(raiseDice).not.toHaveBeenCalled();
	});

	it('sets a pending amount without treating the difference as a stopped Wound', async () => {
		const hero = creature('Hero', 0);
		hero.rules = [pending(plan('set', 1))];

		expect(await grant(hero, 2)).toEqual({ actorName: 'Hero', before: 0, after: 1 });
		expect(recover).not.toHaveBeenCalled();
	});

	it('gives a redirected Wound to the other actor and does not observe it on the first', async () => {
		const hero = creature('Hero', 1);
		const villain = creature('Villain', 0);
		hero.rules = [pending(plan('redirect', Number.POSITIVE_INFINITY))];

		const record = await grant(hero, 2, {
			source: { uuid: villain.uuid, name: villain.name, actor: villain },
		});

		expect(record).toEqual({ actorName: 'Hero', before: 1, after: 1 });
		expect(hero.update).not.toHaveBeenCalled();
		expect(villain.system.attributes.wounds.value).toBe(2);
		expect(recover).not.toHaveBeenCalled();
		expect(raiseDice).not.toHaveBeenCalled();
	});

	it('leaves a redirected Wound where it is when the next step would send it back', async () => {
		const hero = creature('Hero', 0);
		const villain = creature('Villain', 1);
		hero.rules = [
			pending(plan('redirect', Number.POSITIVE_INFINITY), { watch: 'self' }),
			pending(plan('redirect', Number.POSITIVE_INFINITY, { redirectTo: 'watcher' }), {
				watch: 'allies',
				label: 'Back',
			}),
		];

		await grant(hero, 1, {
			source: { uuid: villain.uuid, name: villain.name, actor: villain },
			watchers: [hero],
		});

		expect(hero.system.attributes.wounds.value).toBe(0);
		expect(villain.system.attributes.wounds.value).toBe(2);
		expect(recover).not.toHaveBeenCalled();
	});

	it('does not take the Wounds when the player declines', async () => {
		const hero = creature('Hero', 0);
		hero.rules = [pending(plan('negate', Number.POSITIVE_INFINITY), { choice: 'offer' })];

		const outcome = await alterPendingWound({
			actor: hero,
			amount: 2,
			choose: async () => false,
		});

		expect(outcome.land).toBe(2);
		expect(outcome.negated).toBe(0);
		expect(recover).not.toHaveBeenCalled();
	});

	it('uses an offered stop when the player accepts, and observes it', async () => {
		const hero = creature('Hero', 0);
		hero.rules = [
			pending(plan('negate', Number.POSITIVE_INFINITY), {
				choice: 'offer',
				label: 'Unyielding Resolve',
			}),
		];

		const outcome = await alterPendingWound({
			actor: hero,
			amount: 2,
			choose: async (offer) => {
				expect(offer.name).toBe('Unyielding Resolve');
				expect(offer.amount).toBe(2);
				return true;
			},
		});

		expect(outcome.land).toBe(0);
		expect(outcome.negated).toBe(2);
		expect(recover).toHaveBeenCalledTimes(2);
	});

	it('skips an offer when there is no dialog to ask with', async () => {
		const hero = creature('Hero', 0);
		hero.rules = [pending(plan('negate', Number.POSITIVE_INFINITY), { choice: 'offer' })];

		const outcome = await alterPendingWound({ actor: hero, amount: 1 });

		expect(outcome.land).toBe(1);
		expect(outcome.negated).toBe(0);
	});

	it('stops Wounds on a creature that is immune, and still observes them', async () => {
		const hero = creature('Hero', 2);
		hero.rules = [{ type: 'woundImmunity', appliesTo: () => true }];

		const record = await grant(hero, 2);

		expect(record).toEqual({ actorName: 'Hero', before: 2, after: 2 });
		expect(recover).toHaveBeenCalledTimes(2);
		expect(raiseDice).toHaveBeenCalledWith(hero, 2);
	});

	it('does not let an ally’s immunity stop this creature’s Wounds', async () => {
		const hero = creature('Hero', 0);
		const ally = creature('Ally', 0);
		ally.rules = [{ type: 'woundImmunity', appliesTo: () => true, watch: 'allies' }];

		await grant(hero, 1, { watchers: [ally] });

		expect(hero.system.attributes.wounds.value).toBe(1);
		expect(recover).not.toHaveBeenCalled();
	});

	it('lets an ally stop the Wound and records a move for the creature who would take it', async () => {
		const hero = creature('Hero', 0);
		const companion = creature('Companion', 0);
		companion.rules = [
			pending(plan('negate', Number.POSITIVE_INFINITY, { moveDistance: 4 }), {
				watch: 'allies',
				choice: 'offer',
				label: 'Large Protect Me!',
			}),
		];

		const outcome = await alterPendingWound({
			actor: hero,
			amount: 2,
			watchers: [companion],
			choose: async () => true,
		});

		expect(outcome.land).toBe(0);
		expect(outcome.negated).toBe(2);
		expect(outcome.moves).toEqual([
			{ actorUuid: hero.uuid, distance: 4, name: 'Large Protect Me!' },
		]);
		expect(recover).toHaveBeenCalledTimes(2);
	});

	it('stops only a Wound that would fill the track when the rule says so', async () => {
		const lastOnly = pending(plan('negate', Number.POSITIVE_INFINITY), {
			matchesPending: (view: PendingWoundView) => view.reachesLastWound,
		});
		const early = creature('Early', 0);
		early.rules = [lastOnly];
		const last = creature('Last', 5);
		last.rules = [lastOnly];

		expect((await alterPendingWound({ actor: early, amount: 1 })).land).toBe(1);
		expect((await alterPendingWound({ actor: last, amount: 1 })).negated).toBe(1);
	});

	it('tells the rule the cause, the crit, and the headroom', async () => {
		const seen: PendingWoundView[] = [];
		const hero = creature('Hero', 4, 6);
		hero.rules = [
			pending(plan('lower', 0), {
				matchesPending: (view: PendingWoundView) => {
					seen.push(view);
					return false;
				},
			}),
		];

		await alterPendingWound({
			actor: hero,
			amount: 2,
			cause: 'dropToZero',
			critical: true,
			source: { uuid: 'Actor.Villain', name: 'Villain' },
		});

		expect(seen[0]).toMatchObject({
			amount: 2,
			cause: 'dropToZero',
			critical: true,
			headroom: 2,
			reachesLastWound: true,
			source: { uuid: 'Actor.Villain', name: 'Villain' },
		});
	});
});
