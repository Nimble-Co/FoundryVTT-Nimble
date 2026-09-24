import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovementTriggerRule as MovementTriggerRuleType } from './movementTrigger.js';

// tests/setup.ts loads the rules config, so this rule and its imports are
// cached before the mocks below register. Load a fresh copy that sees them.
let MovementTriggerRule: typeof MovementTriggerRuleType;
beforeAll(async () => {
	vi.resetModules();
	({ MovementTriggerRule } = await import('./movementTrigger.js'));
});

const matchMovementTrigger = vi.fn(
	(..._args: unknown[]) => ({ targets: [] }) as { targets: unknown[] } | null,
);
vi.mock('../../utils/movement/matchMovementTrigger.js', () => ({
	matchMovementTrigger: (...args: unknown[]) => matchMovementTrigger(...args),
}));

const postMovementTriggerCard = vi.fn(async (_input: unknown) => ({ id: 'card' }) as unknown);
vi.mock('../../utils/movement/postMovementTriggerCard.js', () => ({
	postMovementTriggerCard: (input: unknown) => postMovementTriggerCard(input),
}));

const DEFAULTS = {
	event: 'selfMoved',
	creature: 'any',
	kinds: ['regular', 'free', 'forced'],
	minSpaces: 0,
	spacesScope: 'thisTurn',
	geometry: 'any',
	reach: 1,
	minTargets: 1,
	observerScope: 'self',
	allyRadius: 6,
	payload: 'use',
	message: '',
	chargePoolIdentifier: '',
};

function makeRule(
	config: Record<string, unknown> = {},
	options: {
		isEmbedded?: boolean;
		predicate?: (domain: Set<string>) => boolean;
		pool?: number;
		actorType?: string;
	} = {},
) {
	const poolItem =
		options.pool === undefined
			? null
			: {
					id: 'pool-item',
					name: 'Reaction',
					flags: { nimble: { chargePools: { lash: { current: options.pool, max: 1 } } } },
					rules: new Map([
						[
							'pool-rule',
							{
								type: 'chargePool',
								disabled: false,
								id: 'lash',
								identifier: 'lash',
								scope: 'item',
								max: '1',
								initial: 'max',
								recoveries: [],
							},
						],
					]),
					update: vi.fn(async () => undefined),
				};
	const actor = {
		id: 'observer',
		name: 'Observer',
		type: options.actorType ?? 'character',
		flags: {},
		getDomain: () => new Set<string>(['self:raging']),
		getRollData: () => ({}),
		items: {
			contents: poolItem ? [poolItem] : [],
			get: (id: string) => (poolItem && id === poolItem.id ? poolItem : undefined),
		},
		update: vi.fn(async () => undefined),
	};
	const item = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: 'Chaos Lash',
		uuid: 'Actor.observer.Item.lash',
		getDomain: () => new Set<string>(),
	};
	const rule = new MovementTriggerRule({ type: 'movementTrigger' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, { ...DEFAULTS, disabled: false, id: 'rule-1', label: '', ...config });
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	const predicate = options.predicate;
	Object.defineProperty(rule, 'predicate', {
		get: () => (predicate ? { size: 1, test: predicate } : { size: 0 }),
		configurable: true,
	});
	return { rule, actor, item, poolItem };
}

function makeContext(overrides: Record<string, unknown> = {}) {
	const sceneTokens = [{ id: 'a' }, { id: 'b' }];
	const moverToken = { id: 'mover', name: 'Goblin', parent: { tokens: sceneTokens } };
	const observerToken = { id: 'obs', name: 'Observer' };
	return {
		record: {
			token: moverToken,
			actor: { name: 'Goblin actor' },
			spaces: 3,
			spacesThisTurn: 5,
			...overrides,
		},
		actor: {},
		token: observerToken,
		isMover: false,
	};
}

type TriggerInput = {
	actor: unknown;
	item: unknown;
	token: unknown;
	payload: string;
	message: string;
	targets: string[];
	moverName: string;
	spaces: number;
	spacesThisTurn: number | null;
};

function lastCard(): TriggerInput {
	return postMovementTriggerCard.mock.calls.at(-1)?.[0] as TriggerInput;
}

describe('MovementTriggerRule', () => {
	beforeEach(() => {
		matchMovementTrigger.mockReset();
		matchMovementTrigger.mockReturnValue({ targets: [] });
		postMovementTriggerCard.mockClear();
	});

	describe('schema', () => {
		let schema: Record<
			string,
			{
				initial?: unknown;
				choices?: unknown;
				element?: { choices?: unknown };
				options?: Record<string, unknown>;
			}
		> = {};
		beforeAll(() => {
			schema = MovementTriggerRule.defineSchema() as unknown as typeof schema;
		});

		it('defines every field with its default', () => {
			for (const [key, value] of Object.entries(DEFAULTS)) {
				expect(schema[key]?.initial, key).toEqual(value);
			}
			expect(schema.type?.initial).toBe('movementTrigger');
		});

		it('offers the choices of the matcher', () => {
			expect(schema.event?.choices).toEqual(['selfMoved', 'creatureMoved']);
			expect(schema.creature?.choices).toEqual(['enemy', 'ally', 'any']);
			expect(schema.kinds?.element?.choices).toEqual(['regular', 'free', 'forced']);
			expect(schema.spacesScope?.choices).toEqual(['thisTurn', 'thisMovement']);
			expect(schema.geometry?.choices).toEqual([
				'any',
				'endsAdjacent',
				'enteredReach',
				'leftReach',
				'inPath',
				'movedToward',
			]);
			expect(schema.observerScope?.choices).toEqual(['self', 'selfOrAllyWithin']);
			expect(schema.payload?.choices).toEqual(['use', 'reminder']);
			expect(schema.chargePoolIdentifier?.options?.widget).toBe('chargePoolPicker');
		});

		it('shows the dependent fields only when they apply', () => {
			const show = (key: string) => schema[key]?.options?.showWhen as (d: object) => boolean;
			expect(show('reach')({ geometry: 'enteredReach' })).toBe(true);
			expect(show('reach')({ geometry: 'leftReach' })).toBe(true);
			expect(show('reach')({ geometry: 'endsAdjacent' })).toBe(true);
			expect(show('reach')({ geometry: 'inPath' })).toBe(false);
			expect(show('reach')({ geometry: 'any' })).toBe(false);
			expect(show('minTargets')({ event: 'selfMoved', geometry: 'inPath' })).toBe(true);
			expect(show('minTargets')({ event: 'selfMoved', geometry: 'any' })).toBe(false);
			expect(show('minTargets')({ event: 'creatureMoved', geometry: 'inPath' })).toBe(false);
			expect(show('observerScope')({ event: 'creatureMoved' })).toBe(true);
			expect(show('observerScope')({ event: 'selfMoved' })).toBe(false);
			expect(
				show('allyRadius')({ event: 'creatureMoved', observerScope: 'selfOrAllyWithin' }),
			).toBe(true);
			expect(show('allyRadius')({ event: 'creatureMoved', observerScope: 'self' })).toBe(false);
		});
	});

	it('lists in the triggers group with a description', () => {
		expect(MovementTriggerRule.group).toBe('triggers');
		expect(MovementTriggerRule.description).toBe('NIMBLE.rules.movementTrigger.description');
	});

	describe('guards', () => {
		it('does not fire when the item is not embedded on an actor', async () => {
			await makeRule({}, { isEmbedded: false }).rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
		});

		it('does not fire when disabled', async () => {
			await makeRule({ disabled: true }).rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
		});

		it('fires only when the predicate passes', async () => {
			await makeRule({}, { predicate: () => false }).rule.onMovementFinished(
				makeContext() as never,
			);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
			await makeRule(
				{},
				{ predicate: (domain) => domain.has('self:raging') },
			).rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).toHaveBeenCalledTimes(1);
		});
	});

	describe('onMovementFinished', () => {
		it('passes the record, observer, and rule options to the matcher', async () => {
			const { rule } = makeRule({ event: 'creatureMoved', geometry: 'enteredReach', reach: 2 });
			const context = makeContext();
			await rule.onMovementFinished(context as never);

			expect(matchMovementTrigger).toHaveBeenCalledWith(
				context.record,
				context.token,
				false,
				{
					event: 'creatureMoved',
					creature: 'any',
					kinds: ['regular', 'free', 'forced'],
					minSpaces: 0,
					spacesScope: 'thisTurn',
					geometry: 'enteredReach',
					reach: 2,
					minTargets: 1,
					observerScope: 'self',
					allyRadius: 6,
				},
				context.record.token.parent.tokens,
			);
		});

		it('posts nothing when the matcher does not fire', async () => {
			matchMovementTrigger.mockReturnValue(null);
			await makeRule().rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
		});

		it('posts a card for this item with the found targets and the Movement numbers', async () => {
			matchMovementTrigger.mockReturnValue({
				targets: [
					{ uuid: 'Scene.s.Token.a', name: 'Ann' },
					{ uuid: 'Scene.s.Token.b', name: 'Bob' },
				],
			});
			const { rule, actor, item } = makeRule({
				payload: 'reminder',
				message: '{mover} moved {spaces} ({spacesMovedThisTurn} this turn) near {targets}.',
			});
			const context = makeContext();
			await rule.onMovementFinished(context as never);

			expect(lastCard()).toEqual({
				actor,
				item,
				token: context.token,
				payload: 'reminder',
				message: 'Goblin moved 3 (5 this turn) near Ann, Bob.',
				targets: ['Scene.s.Token.a', 'Scene.s.Token.b'],
				moverName: 'Goblin',
				spaces: 3,
				spacesThisTurn: 5,
			});
		});

		it('uses a default message for each payload when the message is empty', async () => {
			const context = makeContext({ spaces: 1, spacesThisTurn: 1 });
			await makeRule({ payload: 'use' }).rule.onMovementFinished(context as never);
			const use = lastCard().message;
			await makeRule({ payload: 'reminder' }).rule.onMovementFinished(context as never);
			const reminder = lastCard().message;
			expect(use).toContain('Goblin');
			expect(reminder).toContain('Goblin');
			expect(use).not.toBe(reminder);
			for (const message of [use, reminder]) {
				expect(message).not.toContain('{');
				expect(message).not.toContain('1 spaces');
			}
		});

		it('keeps unknown spaces this turn as null and says unknown in the message', async () => {
			await makeRule({ message: '{spacesMovedThisTurn} this turn' }).rule.onMovementFinished(
				makeContext({ spacesThisTurn: null }) as never,
			);
			expect(lastCard().spacesThisTurn).toBeNull();
			expect(lastCard().message).toBe('unknown this turn');
		});
	});

	describe('charge pool', () => {
		it('an empty identifier is unlimited', async () => {
			const { rule } = makeRule();
			await rule.onMovementFinished(makeContext() as never);
			await rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).toHaveBeenCalledTimes(2);
		});

		it('fires while the pool has a charge and spends one', async () => {
			const { rule, poolItem } = makeRule({ chargePoolIdentifier: 'lash' }, { pool: 1 });
			await rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).toHaveBeenCalledTimes(1);
			expect(poolItem?.update).toHaveBeenCalledWith(
				{ 'flags.nimble.chargePools': { lash: expect.objectContaining({ current: 0 }) } },
				expect.anything(),
			);
		});

		it('spends no charge when the card is not posted', async () => {
			postMovementTriggerCard.mockResolvedValueOnce(null);
			const { rule, poolItem } = makeRule({ chargePoolIdentifier: 'lash' }, { pool: 1 });
			await rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).toHaveBeenCalledTimes(1);
			expect(poolItem?.update).not.toHaveBeenCalled();
		});

		it('does not fire on an empty pool', async () => {
			await makeRule({ chargePoolIdentifier: 'lash' }, { pool: 0 }).rule.onMovementFinished(
				makeContext() as never,
			);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
		});

		it('does not fire for an actor that is not a character', async () => {
			await makeRule(
				{ chargePoolIdentifier: 'lash' },
				{ pool: 1, actorType: 'npc' },
			).rule.onMovementFinished(makeContext() as never);
			expect(postMovementTriggerCard).not.toHaveBeenCalled();
		});
	});

	it('several rules each post their own card', async () => {
		await makeRule({ payload: 'use' }).rule.onMovementFinished(makeContext() as never);
		await makeRule({ payload: 'reminder' }).rule.onMovementFinished(makeContext() as never);
		expect(postMovementTriggerCard).toHaveBeenCalledTimes(2);
	});
});
