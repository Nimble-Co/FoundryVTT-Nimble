import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	applyRecoveryTriggersToPools,
	buildEffectiveChargePoolMap,
} from '#utils/chargePool/helpers.js';
import type { CharacterActorLike, ChargePoolMap } from '#utils/chargePool/types.js';
import { resolveWouldDropToZero } from '#utils/wounds/wouldDropToZero.js';
import { WouldDropToZeroRule } from '../wouldDropToZero.js';

const feature = JSON.parse(
	readFileSync(
		resolve(
			'packs/classFeatures/core/hunter/hunter-subclasses/keeper-of-the-wildheart/ha-im-over-here.json',
		),
		'utf8',
	),
) as { name: string; system: { rules: Record<string, unknown>[] } };

function ruleOf(type: string) {
	return feature.system.rules.find((rule) => rule.type === type);
}

function chargesOf(pools: ChargePoolMap): number {
	return Object.values(pools).find((pool) => pool.identifier === 'ha-im-over-here')?.current ?? -1;
}

describe("Ha! I'm Over Here!", () => {
	it('is once per safe rest', () => {
		expect(ruleOf('chargePool')).toMatchObject({
			identifier: 'ha-im-over-here',
			max: '1',
			recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
		});
	});

	it('stops an attack that would drop the hunter, then offers a move of their speed away', () => {
		expect(ruleOf('wouldDropToZero')).toMatchObject({
			response: 'prevent',
			choice: 'automatic',
			moveDistance: '@speed',
			moveDirection: 'away',
			onlyAttack: true,
			watch: 'self',
			chargePoolIdentifier: 'ha-im-over-here',
		});
	});

	it('refills the use on a safe rest, and not when an encounter ends', () => {
		const rules = feature.system.rules.map((rule) => ({ ...rule }));
		const item = {
			id: 'ha-im-over-here',
			name: feature.name,
			flags: {},
			rules: new Map(rules.map((rule, index) => [String(index), rule])),
		};
		const actor = {
			type: 'character',
			system: { levelUpHistory: [] },
			items: { contents: [item], get: () => item },
			rules,
			flags: {},
			getDomain: () => new Set<string>(),
			getRollData: () => ({}),
		} as unknown as CharacterActorLike;

		const spent = buildEffectiveChargePoolMap(actor);
		const pool = Object.values(spent).find((entry) => entry.identifier === 'ha-im-over-here');
		expect(pool?.current).toBe(1);
		if (pool) pool.current = 0;

		expect(chargesOf(applyRecoveryTriggersToPools(actor, spent, ['encounterEnd']))).toBe(0);
		expect(chargesOf(applyRecoveryTriggersToPools(actor, spent, ['safeRest']))).toBe(1);
	});

	it('prevents one attack drop per safe rest, and still prevents it when the move is not taken', async () => {
		const pools = { 'ha-im-over-here': { current: 1, max: 1 } };
		const item = {
			id: 'ha-im-over-here',
			name: feature.name,
			flags: { [SYSTEM_ID]: { chargePools: pools } },
			rules: new Map([
				[
					'pool',
					{
						type: 'chargePool',
						disabled: false,
						id: 'pool',
						identifier: 'ha-im-over-here',
						scope: 'item',
						max: '1',
						initial: 'max',
						label: "Ha! I'm Over Here!",
						recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '1' }],
					},
				],
			]),
			update: vi.fn(async (changes: Record<string, { current: number }>) => {
				const next = changes[`flags.${SYSTEM_ID}.chargePools`]?.['ha-im-over-here'];
				if (next) pools['ha-im-over-here'].current = next.current;
			}),
		};
		const actor = {
			uuid: 'Actor.Hunter',
			name: 'Hunter',
			type: 'character',
			rules: [] as unknown[],
			items: { contents: [item] },
			system: { attributes: { movement: { walk: 6 } } },
			getRollData: () => ({}),
			getDomain: () => [],
			update: vi.fn(async () => undefined),
		};
		const rule = new WouldDropToZeroRule(
			{ type: 'wouldDropToZero' } as never,
			{
				parent: {
					isEmbedded: true,
					actor,
					name: item.name,
					uuid: 'item',
					getDomain: () => [],
				},
				strict: false,
			} as never,
		);
		Object.assign(rule, {
			type: 'wouldDropToZero',
			response: 'prevent',
			choice: 'automatic',
			woundInstead: '',
			moveDistance: '@speed',
			moveDirection: 'away',
			onlyAttack: true,
			chargePoolIdentifier: 'ha-im-over-here',
			watch: 'self',
			reach: 0,
			disabled: false,
			label: "Ha! I'm Over Here!",
			priority: 2,
		});
		Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
		Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
		actor.rules = [rule];

		const missed = await resolveWouldDropToZero({ actor, attack: false });
		expect(missed.response).toBe('land');
		expect(pools['ha-im-over-here'].current).toBe(1);

		const saved = await resolveWouldDropToZero({
			actor,
			attack: true,
			source: { uuid: null, name: 'Wolf' },
		});
		expect(saved.response).toBe('prevent');
		expect(saved.woundInstead).toBe(0);
		expect(saved.moves).toEqual([
			{
				actorUuid: actor.uuid,
				distance: 6,
				name: "Ha! I'm Over Here!",
				direction: 'away',
			},
		]);
		expect(pools['ha-im-over-here'].current).toBe(0);

		const again = await resolveWouldDropToZero({ actor, attack: true });
		expect(again.response).toBe('land');
		expect(again.moves).toEqual([]);
	});
});
