import type { Mock } from 'vitest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemHookName } from '#system';
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
	message: '',
};

function makeRule(
	config: Record<string, unknown> = {},
	options: {
		isEmbedded?: boolean;
		predicate?: (domain: Set<string>) => boolean;
	} = {},
) {
	const actor = {
		id: 'observer',
		name: 'Observer',
		type: 'character',
		getDomain: () => new Set<string>(['self:raging']),
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
	return { rule, actor, item };
}

type Combatants = { tokenId: string; sceneId: string }[];

function startedCombat(tokenIds: string[], started = true) {
	const combatants: Combatants = tokenIds.map((tokenId) => ({ tokenId, sceneId: 's' }));
	return { started, combatants };
}

function setCombats(combats: { started: boolean; combatants: Combatants }[]) {
	vi.stubGlobal('game', { ...(globalThis as unknown as { game: object }).game, combats });
}

function makeContext(overrides: Record<string, unknown> = {}) {
	const sceneTokens = [{ id: 'a' }, { id: 'b' }];
	const moverToken = { id: 'mover', name: 'Goblin', parent: { id: 's', tokens: sceneTokens } };
	const observerToken = { id: 'obs', name: 'Observer', parent: { id: 's' } };
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
		setCombats([startedCombat(['mover', 'obs'])]);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
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

		it('has no charge pool of its own; a limited item gates on its pool tag instead', () => {
			expect(schema.chargePoolIdentifier).toBeUndefined();
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

		describe('combat', () => {
			it('posts nothing out of combat, and does not run the matcher', async () => {
				setCombats([]);
				await makeRule().rule.onMovementFinished(makeContext() as never);
				expect(matchMovementTrigger).not.toHaveBeenCalled();
				expect(postMovementTriggerCard).not.toHaveBeenCalled();
			});

			it('posts nothing when the combat has not started', async () => {
				setCombats([startedCombat(['mover', 'obs'], false)]);
				await makeRule().rule.onMovementFinished(makeContext() as never);
				expect(postMovementTriggerCard).not.toHaveBeenCalled();
			});

			it('posts nothing when the observer is in combat but the mover is not', async () => {
				setCombats([startedCombat(['obs'])]);
				await makeRule().rule.onMovementFinished(makeContext() as never);
				expect(postMovementTriggerCard).not.toHaveBeenCalled();
			});

			it('posts nothing when the mover is in combat but the observer is not', async () => {
				setCombats([startedCombat(['mover'])]);
				await makeRule().rule.onMovementFinished(makeContext() as never);
				expect(postMovementTriggerCard).not.toHaveBeenCalled();
			});

			it('posts when both tokens are in a started combat', async () => {
				setCombats([startedCombat(['mover', 'obs'])]);
				await makeRule().rule.onMovementFinished(makeContext() as never);
				expect(postMovementTriggerCard).toHaveBeenCalledTimes(1);
			});
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
				message: '{mover} moved {spaces} ({spacesMovedThisTurn} this turn) near {targets}.',
			});
			const context = makeContext();
			await rule.onMovementFinished(context as never);

			expect(lastCard()).toEqual({
				actor,
				item,
				token: context.token,
				message: 'Goblin moved 3 (5 this turn) near Ann, Bob.',
				targets: ['Scene.s.Token.a', 'Scene.s.Token.b'],
				moverName: 'Goblin',
				spaces: 3,
				spacesThisTurn: 5,
			});
		});

		it('uses the default message when the message is empty', async () => {
			await makeRule({ message: '  ' }).rule.onMovementFinished(makeContext() as never);
			const template = game.i18n.localize('NIMBLE.rules.movementTrigger.defaultMessage');
			expect(lastCard().message).toBe(template.replaceAll('{mover}', 'Goblin'));
		});

		it('keeps unknown spaces this turn as null and says unknown in the message', async () => {
			await makeRule({ message: '{spacesMovedThisTurn} this turn' }).rule.onMovementFinished(
				makeContext({ spacesThisTurn: null }) as never,
			);
			expect(lastCard().spacesThisTurn).toBeNull();
			expect(lastCard().message).toBe('unknown this turn');
		});
	});

	describe('with rule automation off, through the rule event dispatcher', () => {
		type Handler = (...args: unknown[]) => unknown;
		let handlers: Map<string, Handler>;

		beforeAll(async () => {
			const on = Hooks.on as unknown as Mock;
			on.mockClear();
			const { default: register } = await import('../../hooks/ruleEventDispatch.js');
			register();
			handlers = new Map(on.mock.calls.map(([event, handler]) => [event, handler as Handler]));
		});

		it('still posts its card', async () => {
			const game = (globalThis as unknown as { game: { user: { id: string } } }).game;
			vi.stubGlobal('game', {
				...game,
				users: { activeGM: { id: game.user.id } },
				settings: {
					get: (_scope: string, key: string) => key !== 'automation.applyRuleEffects',
				},
			});
			const { rule, actor } = makeRule();
			const scene = { id: 's', tokens: [] as object[] };
			const moverToken = { id: 'mover', name: 'Goblin', actor: { name: 'Goblin' }, parent: scene };
			const observerToken = { id: 'obs', name: 'Observer', actor, parent: scene };
			scene.tokens.push(moverToken, observerToken);
			Object.assign(actor, { rules: [rule] });

			await handlers.get(systemHookName('movementFinished'))?.({
				token: moverToken,
				actor: moverToken.actor,
				spaces: 3,
				spacesThisTurn: 3,
			});

			expect(postMovementTriggerCard).toHaveBeenCalledTimes(1);
			expect(MovementTriggerRule.alwaysDispatchedEvents).toEqual(['onMovementFinished']);
		});
	});

	it('several rules each post their own card', async () => {
		await makeRule().rule.onMovementFinished(makeContext() as never);
		await makeRule({ message: 'second' }).rule.onMovementFinished(makeContext() as never);
		expect(postMovementTriggerCard).toHaveBeenCalledTimes(2);
	});
});
