import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import { ChargePoolService } from '#utils/chargePoolService.js';

type MockRule = {
	type: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	label?: string;
	scope?: string;
	max?: string;
	initial?: string;
	recoveries?: unknown;
	poolIdentifier?: string;
	poolScope?: string;
	cost?: string;
};

type MockItem = {
	id: string;
	name: string;
	actor: MockActor;
	rules: Map<string, MockRule>;
	flags: Record<string, Record<string, unknown>>;
	update: (changes: Record<string, unknown>) => Promise<unknown>;
};

type MockActor = {
	type: 'character';
	items: {
		contents: MockItem[];
		get: (id: string) => MockItem | undefined;
	};
	flags: {
		nimble: {
			chargePools: Record<string, unknown>;
		};
	};
	getRollData: () => Record<string, unknown>;
	getFlag: (scope: string, key: string) => unknown;
	update: ReturnType<typeof vi.fn>;
};

function applyChargePoolUpdatePayload(
	existingPools: Record<string, unknown>,
	payload: unknown,
): Record<string, unknown> {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return existingPools;
	}

	const nextPools = { ...existingPools };
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (key.startsWith('-=')) {
			delete nextPools[key.slice(2)];
			continue;
		}
		nextPools[key] = value;
	}

	return nextPools;
}

function createMockItem(
	sourceItem: {
		id: string;
		name: string;
		rules: MockRule[];
		itemFlags?: Record<string, Record<string, unknown>>;
	},
	actorRef: { current: MockActor },
): MockItem {
	const itemFlags = sourceItem.itemFlags ?? { nimble: { chargePools: {} } };
	const mockItem: MockItem = {
		id: sourceItem.id,
		name: sourceItem.name,
		actor: actorRef.current,
		rules: new Map(sourceItem.rules.map((rule, index) => [String(index), rule])),
		flags: itemFlags,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const pools = (changes as Record<string, unknown>)['flags.nimble.chargePools'];
			const existingPools = itemFlags.nimble.chargePools as Record<string, unknown>;
			itemFlags.nimble.chargePools = applyChargePoolUpdatePayload(existingPools, pools);
			return {} as Actor.Implementation;
		}),
	};
	return mockItem;
}

function createMockActor(params: {
	rollData?: Record<string, unknown>;
	items: Array<{
		id: string;
		name: string;
		rules: MockRule[];
		itemFlags?: Record<string, Record<string, unknown>>;
	}>;
	chargePools?: Record<string, unknown>;
}): MockActor {
	const actorFlags = {
		nimble: {
			chargePools: params.chargePools ?? {},
		},
	};

	const actor: MockActor = {
		type: 'character' as const,
		items: {
			contents: [],
			get: (id: string) => actor.items.contents.find((i) => i.id === id),
		},
		flags: actorFlags,
		getRollData: () => params.rollData ?? {},
		getFlag: (scope: string, key: string) => {
			if (scope !== ChargePoolRuleConfig.flagScope || key !== ChargePoolRuleConfig.flagKey) {
				return undefined;
			}
			return actor.flags.nimble.chargePools;
		},
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const nextPools =
				foundry.utils.getProperty(changes, ChargePoolRuleConfig.flagPath) ??
				(changes[ChargePoolRuleConfig.flagPath] as unknown);
			const existingPools = actor.flags.nimble.chargePools as Record<string, unknown>;
			actor.flags.nimble.chargePools = applyChargePoolUpdatePayload(existingPools, nextPools);
			return actor as unknown as Actor.Implementation;
		}),
	};

	const actorRef = { current: actor };
	actor.items.contents = params.items.map((item) => createMockItem(item, actorRef));

	return actor;
}

describe('ChargePoolService', () => {
	it('mock correctly stores item flags', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'test-item',
					name: 'Test Item',
					rules: [],
					itemFlags: {
						nimble: {
							chargePools: {
								'test-pool': { current: 5, max: 10, recoveries: [] },
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		expect(item.flags.nimble.chargePools).toBeDefined();
		expect((item.flags.nimble.chargePools as Record<string, unknown>)['test-pool']).toBeDefined();
		expect(
			(
				(item.flags.nimble.chargePools as Record<string, unknown>)['test-pool'] as Record<
					string,
					unknown
				>
			).current,
		).toBe(5);

		const newPools = { 'test-pool': { current: 10, max: 10, recoveries: [] } };
		await item.update({
			'flags.nimble.chargePools': newPools,
		} as unknown as Record<string, unknown>);

		expect(item.update).toHaveBeenCalled();
		expect(
			(
				(item.flags.nimble.chargePools as Record<string, unknown>)['test-pool'] as Record<
					string,
					unknown
				>
			).current,
		).toBe(10);
	});

	it('blocks activation when pool has insufficient charges', () => {
		const actor = createMockActor({
			items: [
				{
					id: 'item-1',
					name: 'Wand',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'wand',
							scope: 'item',
							max: '2',
							initial: 'max',
						},
						{
							type: 'chargeConsumer',
							id: 'consume-rule',
							poolIdentifier: 'wand',
							poolScope: 'item',
							cost: '3',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								wand: {
									current: 2,
									max: 2,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		const validation = ChargePoolService.validateItemChargeConsumption(
			item as unknown as Item.Implementation,
		);

		expect(validation.ok).toBe(false);
		expect(validation.failure?.code).toBe('insufficientCharges');
		expect(validation.failure?.available).toBe(2);
		expect(validation.failure?.required).toBe(3);
	});

	it('spends charges on resolved use and applies onHit/onCriticalHit recoveries', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'feature-1',
					name: 'Thrill of the Hunt',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'thoth',
							scope: 'actor',
							max: '5',
							initial: 'max',
							recoveries: [
								{ trigger: 'onHit', mode: 'add', value: '1' },
								{ trigger: 'onCriticalHit', mode: 'add', value: '2' },
							],
						},
						{
							type: 'chargeConsumer',
							id: 'consume-rule',
							poolIdentifier: 'thoth',
							poolScope: 'actor',
							cost: '1',
						},
					],
				},
			],
			chargePools: {
				'actor:thoth': {
					id: 'actor:thoth',
					identifier: 'thoth',
					scope: 'actor',
					sourceItemId: 'feature-1',
					sourceItemName: 'Thrill of the Hunt',
					label: 'Thrill of the Hunt',
					current: 2,
					max: 5,
					recoveries: [
						{ trigger: 'onHit', mode: 'add', value: '1' },
						{ trigger: 'onCriticalHit', mode: 'add', value: '2' },
					],
				},
			},
		});

		const item = actor.items.contents[0];
		const result = await ChargePoolService.consumeOnResolvedItemUse(
			item as unknown as Item.Implementation,
			{ isMiss: false, isCritical: true },
		);

		expect(result.ok).toBe(true);
		expect(result.consumption).toEqual([
			{
				poolLabel: 'Thrill of the Hunt',
				previousValue: 2,
				currentValue: 1,
				maxValue: 5,
				change: -1,
				recovery: {
					trigger: 'onCriticalHit',
					previousValue: 1,
					newValue: 4,
				},
			},
		]);
		expect(actor.update).toHaveBeenCalled();
		expect(
			foundry.utils.getProperty(
				actor.flags,
				`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:thoth.current`,
			),
		).toBe(4);
	});

	it('includes recovery-only pool changes in chat consumption details', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'feature-2',
					name: 'Critical Battery',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-focus',
							identifier: 'focus',
							scope: 'actor',
							max: '3',
							initial: 'max',
							recoveries: [],
						},
						{
							type: 'chargePool',
							id: 'pool-surge',
							identifier: 'surge',
							scope: 'actor',
							max: '3',
							initial: 'zero',
							recoveries: [{ trigger: 'onCriticalHit', mode: 'add', value: '1' }],
						},
						{
							type: 'chargeConsumer',
							id: 'consume-focus',
							poolIdentifier: 'focus',
							poolScope: 'actor',
							cost: '1',
						},
					],
				},
			],
			chargePools: {
				'actor:focus': {
					id: 'actor:focus',
					identifier: 'focus',
					scope: 'actor',
					sourceItemId: 'feature-2',
					sourceItemName: 'Critical Battery',
					label: 'Critical Battery',
					current: 2,
					max: 3,
					recoveries: [],
				},
				'actor:surge': {
					id: 'actor:surge',
					identifier: 'surge',
					scope: 'actor',
					sourceItemId: 'feature-2',
					sourceItemName: 'Critical Battery',
					label: 'Critical Battery',
					current: 0,
					max: 3,
					recoveries: [{ trigger: 'onCriticalHit', mode: 'add', value: '1' }],
				},
			},
		});

		const item = actor.items.contents[0];
		const result = await ChargePoolService.consumeOnResolvedItemUse(
			item as unknown as Item.Implementation,
			{ isMiss: false, isCritical: true },
		);

		expect(result.ok).toBe(true);
		expect(result.consumption).toEqual([
			{
				poolLabel: 'Critical Battery',
				previousValue: 2,
				currentValue: 1,
				maxValue: 3,
				change: -1,
			},
			{
				poolLabel: 'Critical Battery',
				previousValue: 0,
				currentValue: 0,
				maxValue: 3,
				change: 0,
				recovery: {
					trigger: 'onCriticalHit',
					previousValue: 0,
					newValue: 1,
				},
			},
		]);
		expect(
			foundry.utils.getProperty(
				actor.flags,
				`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:surge.current`,
			),
		).toBe(1);
	});

	it('applies safe rest recovery with refresh mode to item-scoped pool', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'wand-1',
					name: 'Wand of Light',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'wand-light',
							scope: 'item',
							max: '4',
							initial: 'max',
							recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '0' }],
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								'wand-light': {
									current: 1,
									max: 4,
									recoveries: [{ trigger: 'safeRest', mode: 'refresh', value: '0' }],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		await ChargePoolService.applyRestRecovery(actor as unknown as Actor.Implementation, 'safe');

		expect(item.update).toHaveBeenCalled();
		const updatedPool = (item.flags.nimble.chargePools as Record<string, unknown>)[
			'wand-light'
		] as Record<string, unknown>;
		expect(updatedPool).toBeDefined();
		expect(updatedPool.current).toBe(4);
	});

	it('stores item-scoped pool charges on the item itself', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'potion-1',
					name: 'Potion of Healing',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'healing',
							scope: 'item',
							max: '1',
							initial: 'max',
						},
						{
							type: 'chargeConsumer',
							id: 'consume-rule',
							poolIdentifier: 'healing',
							poolScope: 'item',
							cost: '1',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								healing: {
									current: 1,
									max: 1,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		const beforePool = (item.flags.nimble.chargePools as Record<string, unknown>).healing;
		const result = await ChargePoolService.consumeOnResolvedItemUse(
			item as unknown as Item.Implementation,
		);

		expect(result.ok).toBe(true);
		expect(item.update).toHaveBeenCalled();
		const afterPool = (item.flags.nimble.chargePools as Record<string, unknown>).healing;
		expect(beforePool).toBeDefined();
		expect(afterPool).toBeDefined();
	});

	it('items with same identifier on same actor share a pool', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'potion-1',
					name: 'Potion of Healing',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'healing',
							scope: 'item',
							max: '1',
							initial: 'max',
						},
						{
							type: 'chargeConsumer',
							id: 'consume-rule',
							poolIdentifier: 'healing',
							poolScope: 'item',
							cost: '1',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								healing: {
									current: 1,
									max: 1,
									recoveries: [],
								},
							},
						},
					},
				},
				{
					id: 'potion-2',
					name: 'Potion of Healing',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'healing',
							scope: 'item',
							max: '1',
							initial: 'max',
						},
						{
							type: 'chargeConsumer',
							id: 'consume-rule',
							poolIdentifier: 'healing',
							poolScope: 'item',
							cost: '1',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								healing: {
									current: 0,
									max: 1,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const potion1 = actor.items.contents[0];
		const potion2 = actor.items.contents[1];

		const validation1 = ChargePoolService.validateItemChargeConsumption(
			potion1 as unknown as Item.Implementation,
		);
		const validation2 = ChargePoolService.validateItemChargeConsumption(
			potion2 as unknown as Item.Implementation,
		);

		expect(validation1.ok).toBe(false);
		expect(validation1.failure?.code).toBe('insufficientCharges');
		expect(validation2.ok).toBe(false);
		expect(validation2.failure?.code).toBe('insufficientCharges');
	});

	it('adjusts item-scoped pool with clamp to max', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'item-1',
					name: 'Test Item',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'test',
							scope: 'item',
							max: '3',
							initial: 'max',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								test: {
									current: 1,
									max: 3,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		const adjusted = await ChargePoolService.adjustPool(
			actor as unknown as Actor.Implementation,
			'test',
			'set',
			10,
		);

		expect(adjusted).toBe(true);
		expect(item.update).toHaveBeenCalled();
		const updatedPool = (item.flags.nimble.chargePools as Record<string, unknown>).test as Record<
			string,
			unknown
		>;
		expect(updatedPool).toBeDefined();
		expect(updatedPool.current).toBe(3);
	});

	it('applies encounterStart recovery with refresh mode', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-1',
					name: 'Rage',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'rage',
							scope: 'item',
							max: '3',
							initial: 'max',
							recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '0' }],
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								rage: {
									current: 0,
									max: 3,
									recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '0' }],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		await ChargePoolService.applyEncounterRecovery(
			actor as unknown as Actor.Implementation,
			'encounterStart',
		);

		expect(item.update).toHaveBeenCalled();
		const updatedPool = (item.flags.nimble.chargePools as Record<string, unknown>).rage as Record<
			string,
			unknown
		>;
		expect(updatedPool).toBeDefined();
		expect(updatedPool.current).toBe(3);
	});

	it('applies encounterEnd recovery with set mode', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-1',
					name: 'Second Wind',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'secondwind',
							scope: 'item',
							max: '1',
							initial: 'max',
							recoveries: [{ trigger: 'encounterEnd', mode: 'set', value: '1' }],
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								secondwind: {
									current: 0,
									max: 1,
									recoveries: [{ trigger: 'encounterEnd', mode: 'set', value: '1' }],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		await ChargePoolService.applyEncounterRecovery(
			actor as unknown as Actor.Implementation,
			'encounterEnd',
		);

		expect(item.update).toHaveBeenCalled();
		const updatedPool = (item.flags.nimble.chargePools as Record<string, unknown>)
			.secondwind as Record<string, unknown>;
		expect(updatedPool).toBeDefined();
		expect(updatedPool.current).toBe(1);
	});

	it('applies encounterStart recovery with add mode', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-1',
					name: 'Battle Master',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'maneuvers',
							scope: 'actor',
							max: '4',
							initial: 'max',
							recoveries: [{ trigger: 'encounterStart', mode: 'add', value: '2' }],
						},
					],
				},
			],
			chargePools: {
				'actor:maneuvers': {
					id: 'actor:maneuvers',
					identifier: 'maneuvers',
					scope: 'actor',
					sourceItemId: 'ability-1',
					sourceItemName: 'Battle Master',
					label: 'Battle Master',
					current: 1,
					max: 4,
					recoveries: [{ trigger: 'encounterStart', mode: 'add', value: '2' }],
				},
			},
		});

		await ChargePoolService.applyEncounterRecovery(
			actor as unknown as Actor.Implementation,
			'encounterStart',
		);

		expect(actor.update).toHaveBeenCalled();
		const updatedPool = foundry.utils.getProperty(
			actor.flags,
			`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:maneuvers.current`,
		);
		expect(updatedPool).toBe(3);
	});

	it('does not apply encounterEnd recovery when no triggers match', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-1',
					name: 'Rogue Cunning',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'cunning',
							scope: 'item',
							max: '3',
							initial: 'max',
							recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '0' }],
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								cunning: {
									current: 1,
									max: 3,
									recoveries: [{ trigger: 'encounterStart', mode: 'refresh', value: '0' }],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		await ChargePoolService.applyEncounterRecovery(
			actor as unknown as Actor.Implementation,
			'encounterEnd',
		);

		expect(item.update).not.toHaveBeenCalled();
		const pool = (item.flags.nimble.chargePools as Record<string, unknown>).cunning as Record<
			string,
			unknown
		>;
		expect(pool.current).toBe(1);
	});

	it('previewRecovery and applyRestRecovery stay aligned for add mode with clamping', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-1',
					name: 'Battle Trance',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'focus',
							scope: 'actor',
							max: '4',
							initial: 'max',
							recoveries: [{ trigger: 'safeRest', mode: 'add', value: '5' }],
						},
					],
				},
			],
			chargePools: {
				'actor:focus': {
					id: 'actor:focus',
					identifier: 'focus',
					scope: 'actor',
					sourceItemId: 'ability-1',
					sourceItemName: 'Battle Trance',
					label: 'Battle Trance',
					current: 3,
					max: 4,
					icon: 'fa-solid fa-bolt',
					recoveries: [{ trigger: 'safeRest', mode: 'add', value: '5' }],
				},
			},
		});

		const preview = ChargePoolService.previewRecovery(
			actor as unknown as Actor.Implementation,
			'safeRest',
		);
		expect(preview).toEqual([
			{
				poolId: 'actor:focus',
				label: 'Battle Trance',
				icon: 'fa-solid fa-bolt',
				previousValue: 3,
				newValue: 4,
				maxValue: 4,
				recoveredAmount: 1,
			},
		]);

		await ChargePoolService.applyRestRecovery(actor as unknown as Actor.Implementation, 'safe');
		expect(
			foundry.utils.getProperty(
				actor.flags,
				`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:focus.current`,
			),
		).toBe(4);
	});

	it('previewRecovery and applyRestRecovery stay aligned for set mode with clamping', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'ability-2',
					name: 'Arcane Reserve',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'reserve',
							scope: 'actor',
							max: '4',
							initial: 'max',
							recoveries: [{ trigger: 'safeRest', mode: 'set', value: '10' }],
						},
					],
				},
			],
			chargePools: {
				'actor:reserve': {
					id: 'actor:reserve',
					identifier: 'reserve',
					scope: 'actor',
					sourceItemId: 'ability-2',
					sourceItemName: 'Arcane Reserve',
					label: 'Arcane Reserve',
					current: 1,
					max: 4,
					recoveries: [{ trigger: 'safeRest', mode: 'set', value: '10' }],
				},
			},
		});

		const preview = ChargePoolService.previewRecovery(
			actor as unknown as Actor.Implementation,
			'safeRest',
		);
		expect(preview).toEqual([
			{
				poolId: 'actor:reserve',
				label: 'Arcane Reserve',
				icon: undefined,
				previousValue: 1,
				newValue: 4,
				maxValue: 4,
				recoveredAmount: 3,
			},
		]);

		await ChargePoolService.applyRestRecovery(actor as unknown as Actor.Implementation, 'safe');
		expect(
			foundry.utils.getProperty(
				actor.flags,
				`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:reserve.current`,
			),
		).toBe(4);
	});

	it('removes stale actor-scoped pools when chargePool rules are removed', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'feature-1',
					name: 'Fighter Feature',
					rules: [],
				},
			],
			chargePools: {
				'actor:obsolete': {
					id: 'actor:obsolete',
					identifier: 'obsolete',
					scope: 'actor',
					sourceItemId: 'feature-1',
					sourceItemName: 'Fighter Feature',
					label: 'Fighter Feature',
					current: 1,
					max: 2,
					recoveries: [],
				},
			},
		});

		await ChargePoolService.syncActorPools(actor as unknown as Actor.Implementation);
		expect(actor.update).toHaveBeenCalled();
		expect(
			foundry.utils.getProperty(
				actor.flags,
				`${ChargePoolRuleConfig.flagScope}.${ChargePoolRuleConfig.flagKey}.actor:obsolete`,
			),
		).toBeUndefined();
	});

	it('removes stale item-scoped pools from item flags when pool rules are removed', async () => {
		const actor = createMockActor({
			items: [
				{
					id: 'item-1',
					name: 'Legacy Wand',
					rules: [],
					itemFlags: {
						nimble: {
							chargePools: {
								legacy: {
									current: 2,
									max: 3,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const item = actor.items.contents[0];
		await ChargePoolService.syncActorPools(actor as unknown as Actor.Implementation);
		expect(item.update).toHaveBeenCalled();
		expect((item.flags.nimble.chargePools as Record<string, unknown>).legacy).toBeUndefined();
	});

	it('getPoolsForItem includes source-only pools and uses exact source item id matching', () => {
		const actor = createMockActor({
			items: [
				{
					id: 'item-1',
					name: 'Arcane Focus',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'focus',
							scope: 'item',
							max: '2',
							initial: 'max',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								focus: {
									current: 1,
									max: 2,
									recoveries: [],
								},
							},
						},
					},
				},
				{
					id: 'item-10',
					name: 'Other Focus',
					rules: [
						{
							type: 'chargePool',
							id: 'pool-rule',
							identifier: 'other-focus',
							scope: 'item',
							max: '2',
							initial: 'max',
						},
					],
					itemFlags: {
						nimble: {
							chargePools: {
								'other-focus': {
									current: 1,
									max: 2,
									recoveries: [],
								},
							},
						},
					},
				},
			],
		});

		const poolsForSource = ChargePoolService.getPoolsForItem(
			actor as unknown as Actor.Implementation,
			'item-1',
		);
		expect(poolsForSource).toHaveLength(1);
		expect(poolsForSource[0]?.id).toBe('focus');

		const poolsForMissingPrefixId = ChargePoolService.getPoolsForItem(
			actor as unknown as Actor.Implementation,
			'item-',
		);
		expect(poolsForMissingPrefixId).toEqual([]);
	});
});
