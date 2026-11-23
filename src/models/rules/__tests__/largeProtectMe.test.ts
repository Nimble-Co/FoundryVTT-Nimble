import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { alterPendingWound } from '#utils/wounds/pendingWound.js';
import { PendingWoundRule } from '../pendingWound.js';

const feature = JSON.parse(
	readFileSync(
		resolve('packs/classFeatures/core/hunter/hunter-subclasses/beastmaster/large-protect-me.json'),
		'utf8',
	),
) as { system: { rules: Record<string, unknown>[] } };

function ruleOf(type: string) {
	return feature.system.rules.find((rule) => rule.type === type);
}

describe('Large Protect Me', () => {
	it('is once per encounter, and twice from level 15', () => {
		const pool = ruleOf('chargePool');
		expect(pool).toMatchObject({
			identifier: 'large-protect-me',
			max: '1',
			recoveries: [{ trigger: 'encounterEnd', mode: 'refresh', value: '1' }],
		});
		expect(ruleOf('modifyPool')).toMatchObject({
			poolIdentifier: 'large-protect-me',
			maxDelta: '1',
			predicate: { level: { min: 15 } },
		});
	});

	it('offers a move of 12 after a Wound before level 7', () => {
		expect(ruleOf('freeMove')).toMatchObject({
			trigger: 'onWound',
			distance: '12',
			recipient: 'self',
			direction: 'any',
			chargePoolIdentifier: 'large-protect-me',
			predicate: { level: { max: 6 } },
		});
	});

	it('stops the Wound before it lands from level 7, and asks first', () => {
		expect(ruleOf('pendingWound')).toMatchObject({
			change: 'negate',
			amount: '',
			choice: 'offer',
			moveDistance: '12',
			watch: 'self',
			chargePoolIdentifier: 'large-protect-me',
			predicate: { level: { min: 7 } },
		});
	});

	it('stops the pending Wound and offers the move only while a charge remains', async () => {
		const pools = { 'large-protect-me': { current: 1, max: 1 } };
		const item = {
			id: 'protect-me',
			name: 'Large - Protect Me!',
			flags: { [SYSTEM_ID]: { chargePools: pools } },
			rules: new Map([
				[
					'pool',
					{
						type: 'chargePool',
						disabled: false,
						id: 'pool',
						identifier: 'large-protect-me',
						scope: 'item',
						max: '1',
						initial: 'max',
						label: 'Large Protect Me!',
						recoveries: [],
					},
				],
			]),
			update: vi.fn(async (changes: Record<string, { current: number }>) => {
				const next = changes[`flags.${SYSTEM_ID}.chargePools`]?.['large-protect-me'];
				if (next) pools['large-protect-me'].current = next.current;
			}),
		};
		const actor: {
			uuid: string;
			name: string;
			type: string;
			rules: unknown[];
			system: { attributes: { wounds: { value: number; max: number } } };
			items: { contents: unknown[] };
			getRollData: () => Record<string, unknown>;
			getDomain: () => string[];
			update: ReturnType<typeof vi.fn>;
		} = {
			uuid: 'Actor.Hunter',
			name: 'Hunter',
			type: 'character',
			rules: [],
			system: { attributes: { wounds: { value: 1, max: 6 } } },
			items: { contents: [item] },
			getRollData: () => ({}),
			getDomain: () => [],
			update: vi.fn(async () => undefined),
		};
		const rule = new PendingWoundRule(
			{ type: 'pendingWound' } as never,
			{
				parent: { isEmbedded: true, actor, name: item.name, uuid: 'item', getDomain: () => [] },
				strict: false,
			} as never,
		);
		Object.assign(rule, {
			type: 'pendingWound',
			change: 'negate',
			amount: '',
			whenAmount: 0,
			choice: 'offer',
			cause: 'any',
			critical: 'any',
			onlyLastWound: false,
			watch: 'self',
			reach: 0,
			redirectTo: 'source',
			moveDistance: '12',
			chargePoolIdentifier: 'large-protect-me',
			disabled: false,
			label: 'Large Protect Me!',
			priority: 4,
		});
		Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
		Object.defineProperty(rule, 'predicate', {
			get: () => ({ size: 0 }),
			configurable: true,
		});
		actor.rules = [rule];

		const declined = await alterPendingWound({
			actor,
			amount: 1,
			choose: async () => false,
		});
		expect(declined.land).toBe(1);
		expect(declined.moves).toEqual([]);
		expect(pools['large-protect-me'].current).toBe(1);

		const accepted = await alterPendingWound({
			actor,
			amount: 1,
			choose: async () => true,
		});
		expect(accepted.land).toBe(0);
		expect(accepted.negated).toBe(1);
		expect(accepted.moves).toEqual([
			{ actorUuid: actor.uuid, distance: 12, name: 'Large Protect Me!' },
		]);
		expect(pools['large-protect-me'].current).toBe(0);

		const spent = await alterPendingWound({
			actor,
			amount: 1,
			choose: async () => true,
		});
		expect(spent.land).toBe(1);
		expect(spent.moves).toEqual([]);
	});
});
