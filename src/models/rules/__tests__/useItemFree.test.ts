import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import type { UseItemFreeRule as UseItemFreeRuleClass } from '../useItemFree.js';

const useItemForFree = vi.fn(async (..._args: unknown[]) => true);
const isActiveGM = vi.fn(() => true);

let UseItemFreeRule: typeof UseItemFreeRuleClass;

async function loadRule(): Promise<void> {
	vi.resetModules();
	vi.doMock('#utils/actor/useItemForFree.js', () => ({ useItemForFree }));
	vi.doMock('#utils/isActiveGM.js', () => ({ isActiveGM }));
	({ UseItemFreeRule } = await import('../useItemFree.js'));
}

function makeActor(domain: string[] = []) {
	const actor = Object.create(Actor.prototype) as Record<string, unknown>;
	actor.getDomain = () => new Set(domain);
	return actor;
}

let ruleCount = 0;

function freeRule(
	actor: object | null,
	source: {
		triggers: string[];
		itemIdentifier?: string;
		freeOf?: string[];
		disabled?: boolean;
		predicate?: Record<string, unknown>;
	},
): UseItemFreeRuleClass {
	ruleCount += 1;
	const rule = new UseItemFreeRule({ type: 'useItemFree' } as never, { strict: false });
	const item = {
		actor,
		isEmbedded: !!actor,
		name: 'Furious Feature',
		uuid: `Actor.a.Item.feature-${ruleCount}`,
		getDomain: () => new Set(),
	};
	Object.defineProperty(rule, 'parent', { value: item, configurable: true });
	Object.assign(rule, {
		id: `rule-${ruleCount}`,
		label: '',
		itemIdentifier: source.itemIdentifier ?? 'rage',
		triggers: source.triggers,
		freeOf: source.freeOf ?? ['action', 'uses'],
		disabled: source.disabled ?? false,
		predicate: new Predicate((source.predicate ?? {}) as never),
	});
	return rule;
}

type TurnContext = Parameters<UseItemFreeRuleClass['onTurnEnd']>[0];
type UsedContext = Parameters<UseItemFreeRuleClass['onItemUsed']>[0];

function turn(actor: object): TurnContext {
	return { combat: {}, combatant: {}, actor } as unknown as TurnContext;
}

function attack(
	sourceActor: object,
	targetActor: object,
	outcome: Partial<Pick<UsedContext, 'isCritical' | 'isMiss' | 'discardedCritTriggers'>>,
	cardId = 'card-1',
): UsedContext {
	return {
		sourceItem: {},
		sourceActor,
		targetActor,
		card: { id: cardId },
		isCritical: false,
		isMiss: false,
		...outcome,
	} as unknown as UsedContext;
}

describe('UseItemFreeRule', () => {
	beforeEach(async () => {
		useItemForFree.mockClear();
		isActiveGM.mockReturnValue(true);
		await loadRule();
	});

	it('is an item rule under triggers, free of actions and uses by default', () => {
		const schema = UseItemFreeRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;

		expect(UseItemFreeRule.worksOnEffects).toBe(false);
		expect(UseItemFreeRule.group).toBe('triggers');
		expect(UseItemFreeRule.description).toBe('NIMBLE.rules.useItemFree.description');
		expect(schema.freeOf.initial).toEqual(['action', 'uses']);
		expect(UseItemFreeRule.alwaysDispatchedEvents).toEqual([]);
	});

	it('uses the named item at the start of the actor turn, on the active GM', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnStart'] }).onActiveGmTurnStart(turn(actor));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
		const [usedBy, identifier, free] = useItemForFree.mock.calls[0] as [
			unknown,
			string,
			{ of: string[]; reason: string },
		];
		expect(usedBy).toBe(actor);
		expect(identifier).toBe('rage');
		expect(free.of).toEqual(['action', 'uses']);
		expect(free.reason).toEqual(expect.any(String));
	});

	it('is always free of actions, also when the list leaves them out', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnEnd'], freeOf: ['mana'] }).onTurnEnd(turn(actor));

		expect((useItemForFree.mock.calls[0]?.[2] as { of: string[] }).of).toEqual(['action', 'mana']);
	});

	it('does nothing for another creature, a trigger not in its list, or no item named', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnStart'] }).onActiveGmTurnStart(turn(makeActor()));
		await freeRule(actor, { triggers: ['onTurnEnd'] }).onActiveGmTurnStart(turn(actor));
		await freeRule(actor, { triggers: ['onTurnStart'], itemIdentifier: ' ' }).onActiveGmTurnStart(
			turn(actor),
		);

		expect(useItemForFree).not.toHaveBeenCalled();
	});

	it('does nothing when disabled or off an actor', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnStart'], disabled: true }).onActiveGmTurnStart(
			turn(actor),
		);
		await freeRule(null, { triggers: ['onTurnStart'] }).onActiveGmTurnStart(turn(actor));

		expect(useItemForFree).not.toHaveBeenCalled();
	});

	it('uses the item only while its predicate passes', async () => {
		const calm = makeActor();
		const dying = makeActor(['self:dying']);
		const predicate = { self: 'dying' };

		await freeRule(calm, { triggers: ['onTurnStart'], predicate }).onActiveGmTurnStart(turn(calm));
		await freeRule(dying, { triggers: ['onTurnStart'], predicate }).onActiveGmTurnStart(
			turn(dying),
		);

		expect(useItemForFree).toHaveBeenCalledTimes(1);
		expect(useItemForFree.mock.calls[0]?.[0]).toBe(dying);
	});

	it('uses the item when an enemy crits the actor, once for each attack card', async () => {
		const actor = makeActor();
		const enemy = makeActor();
		const rule = freeRule(actor, { triggers: ['onCritReceived'] });

		await rule.onAttackReceived(attack(enemy, actor, {}));
		expect(useItemForFree).not.toHaveBeenCalled();

		await rule.onAttackReceived(attack(enemy, actor, { isCritical: true }));
		await rule.onAttackReceived(attack(enemy, actor, { isCritical: true }));
		expect(useItemForFree).toHaveBeenCalledTimes(1);

		await rule.onAttackReceived(attack(enemy, actor, { discardedCritTriggers: true }, 'card-2'));
		expect(useItemForFree).toHaveBeenCalledTimes(2);
	});

	it('uses the item once when an attack of the actor misses several targets', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onMiss'] });

		await rule.onItemUsed(attack(actor, makeActor(), { isMiss: true }));
		await rule.onItemUsed(attack(actor, makeActor(), { isMiss: true }));
		await rule.onItemUsed(attack(actor, makeActor(), {}, 'card-2'));
		await rule.onItemUsed(attack(makeActor(), actor, { isMiss: true }, 'card-3'));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
	});

	it('acts on an event that reaches every client only on the active GM', async () => {
		const actor = makeActor();
		type DyingContext = Parameters<UseItemFreeRuleClass['onActorDying']>[0];
		const dying = { actor, source: null } as unknown as DyingContext;

		isActiveGM.mockReturnValue(false);
		await freeRule(actor, { triggers: ['onDying'] }).onActorDying(dying);
		expect(useItemForFree).not.toHaveBeenCalled();

		isActiveGM.mockReturnValue(true);
		await freeRule(actor, { triggers: ['onDying'] }).onActorDying(dying);
		expect(useItemForFree).toHaveBeenCalledTimes(1);
	});

	it('passes an event that reaches one client on, so the active GM makes the use', async () => {
		const actor = makeActor();
		isActiveGM.mockReturnValue(false);

		await freeRule(actor, { triggers: ['onTurnEnd'] }).onTurnEnd(turn(actor));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
	});

	it('stacks: each rule with the trigger makes its own use', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onRest'] }).onRest({ actor, restType: 'safe' } as never);
		await freeRule(actor, { triggers: ['onRest'], itemIdentifier: 'second-wind' }).onRest({
			actor,
			restType: 'safe',
		} as never);

		expect(useItemForFree.mock.calls.map((call) => call[1])).toEqual(['rage', 'second-wind']);
	});

	it('uses the item on a failed save only', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onSaveFail'] });
		const save = (outcome: string) =>
			({ actor, saveType: 'strength', outcome, messageId: 'm' }) as never;

		await rule.onSaveResolved(save('pass'));
		await rule.onSaveResolved(save('fail'));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
	});
});
