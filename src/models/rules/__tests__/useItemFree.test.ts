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

function makeActor(domain: string[] = [], type = 'character') {
	const actor = Object.create(Actor.prototype) as Record<string, unknown>;
	actor.type = type;
	actor.getDomain = () => new Set(domain);
	return actor;
}

const DAMAGE_STEP = { id: 'd', type: 'damage', parentContext: null, parentNode: null };

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
		freeOf: source.freeOf ?? ['uses', 'mana'],
		disabled: source.disabled ?? false,
		predicate: new Predicate((source.predicate ?? {}) as never),
	});
	return rule;
}

type TurnContext = Parameters<UseItemFreeRuleClass['onTurnEnd']>[0];
type UsedContext = Parameters<UseItemFreeRuleClass['onAttackReceived']>[0];
type ActivatedContext = Parameters<UseItemFreeRuleClass['onItemActivated']>[0];

function activated(
	sourceActor: object,
	system: Record<string, unknown>,
	cardId = 'card-1',
	sourceItem: object = { identifier: 'longsword' },
): ActivatedContext {
	return {
		sourceItem,
		sourceActor,
		card: { id: cardId, system: { activation: { effects: [DAMAGE_STEP] }, ...system } },
	} as unknown as ActivatedContext;
}

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

	it('is an item rule under triggers, free of uses by default, with no action choice', () => {
		const schema = UseItemFreeRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown; element?: { choices?: Record<string, string> } }
		>;

		expect(UseItemFreeRule.worksOnEffects).toBe(false);
		expect(UseItemFreeRule.group).toBe('triggers');
		expect(UseItemFreeRule.description).toBe('NIMBLE.rules.useItemFree.description');
		expect(schema.freeOf.initial).toEqual(['uses', 'mana']);
		expect(Object.keys(schema.freeOf.element?.choices ?? {})).toEqual(['uses', 'mana']);
		expect(UseItemFreeRule.alwaysDispatchedEvents).toEqual([]);
	});

	it('uses the named item at the start of the actor turn, on the active GM', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnStart'] }).onActiveGmTurnStart(turn(actor));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
		const [usedBy, identifier, free] = useItemForFree.mock.calls[0] as [
			unknown,
			string,
			{ of: string[]; reason: unknown },
		];
		expect(usedBy).toBe(actor);
		expect(identifier).toBe('rage');
		expect(free.of).toEqual(['uses', 'mana']);
		expect(free.reason).toEqual({
			key: 'NIMBLE.rules.useItemFree.cardLine',
			data: {
				trigger: { key: 'NIMBLE.rules.useItemFree.reasons.onTurnStart' },
				feature: 'Furious Feature',
			},
		});
	});

	it('passes its own free-of list; the activation adds actions', async () => {
		const actor = makeActor();

		await freeRule(actor, { triggers: ['onTurnEnd'], freeOf: ['mana'] }).onTurnEnd(turn(actor));

		expect((useItemForFree.mock.calls[0]?.[2] as { of: string[] }).of).toEqual(['mana']);
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
		const enemy = makeActor([], 'npc');
		const rule = freeRule(actor, { triggers: ['onCritReceived'] });

		await rule.onAttackReceived(attack(enemy, actor, {}));
		expect(useItemForFree).not.toHaveBeenCalled();

		await rule.onAttackReceived(attack(enemy, actor, { isCritical: true }));
		await rule.onAttackReceived(attack(enemy, actor, { isCritical: true }));
		expect(useItemForFree).toHaveBeenCalledTimes(1);

		await rule.onAttackReceived(attack(enemy, actor, { discardedCritTriggers: true }, 'card-2'));
		expect(useItemForFree).toHaveBeenCalledTimes(2);
	});

	it('does not use the item when an ally crits the actor', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onCritReceived'] });

		await rule.onAttackReceived(attack(makeActor(), actor, { isCritical: true }));

		expect(useItemForFree).not.toHaveBeenCalled();
	});

	it('uses the item when the attack card of the actor misses, once for each card', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onMiss'] });

		await rule.onItemActivated(activated(actor, { isMiss: true }));
		await rule.onItemActivated(activated(actor, { isMiss: true }));
		await rule.onItemActivated(activated(actor, {}, 'card-2'));
		await rule.onItemActivated(activated(makeActor(), { isMiss: true }, 'card-3'));

		expect(useItemForFree).toHaveBeenCalledTimes(1);
	});

	it('reads hit and crit from the card, and a discarded crit that keeps its triggers', async () => {
		const actor = makeActor();
		const onHit = freeRule(actor, { triggers: ['onHit'], itemIdentifier: 'hit' });
		const onCrit = freeRule(actor, { triggers: ['onCrit'], itemIdentifier: 'crit' });

		for (const rule of [onHit, onCrit]) {
			await rule.onItemActivated(activated(actor, {}, 'hit-card'));
			await rule.onItemActivated(activated(actor, { isCritical: true }, 'crit-card'));
			await rule.onItemActivated(
				activated(actor, { isMiss: true, discardedCritTriggers: true }, 'kept-card'),
			);
		}

		expect(useItemForFree.mock.calls.map((call) => call[1])).toEqual(['hit', 'crit', 'crit']);
	});

	it('does nothing for a card with no damage roll, a waiting Keep a Result, or a use of its own item', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onHit'] });

		await rule.onItemActivated({
			sourceItem: {},
			sourceActor: actor,
			card: { id: 'plain', system: { activation: { effects: [] } } },
		} as unknown as ActivatedContext);
		await rule.onItemActivated(activated(actor, { pendingKeep: { id: 'k' } }, 'waiting'));
		await rule.onItemActivated(activated(actor, {}, 'own', { system: { identifier: 'rage' } }));

		expect(useItemForFree).not.toHaveBeenCalled();
	});

	it('forgets old cards, so the list of used cards does not grow', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onMiss'] });

		for (let index = 0; index <= 200; index += 1) {
			await rule.onItemActivated(activated(actor, { isMiss: true }, `card-${index}`));
		}
		await rule.onItemActivated(activated(actor, { isMiss: true }, 'card-0'));

		expect(useItemForFree).toHaveBeenCalledTimes(202);
	});

	it('lets two cards make their uses at the same time', async () => {
		const actor = makeActor();
		const rule = freeRule(actor, { triggers: ['onMiss'] });

		await Promise.all([
			rule.onItemActivated(activated(actor, { isMiss: true }, 'card-a')),
			rule.onItemActivated(activated(actor, { isMiss: true }, 'card-b')),
		]);

		expect(useItemForFree).toHaveBeenCalledTimes(2);
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
