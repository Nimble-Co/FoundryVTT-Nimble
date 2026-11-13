import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import { SYSTEM_ID } from '#system';
import { UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import {
	ApplyConditionRule,
	type ApplyConditionTrigger,
	TRIGGER_CHOICES,
} from '../applyCondition.js';

interface MockActiveEffect {
	condition: string;
	statuses: Set<string>;
	/** What `updateSource` has folded in, standing for the effect's own source data. */
	sourceData: Record<string, unknown>;
	updateSource(data: Record<string, unknown>): void;
	id?: string;
	getFlag?(scope: string, key: string): unknown;
}

interface MockActor {
	isOwner: boolean;
	statuses: Set<string>;
	effects: MockActiveEffect[];
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

interface MockItemEffect {
	transfer: boolean;
	toObject(): Record<string, unknown>;
}

interface MockItem {
	actor: MockActor;
	isEmbedded: boolean;
	name: string;
	uuid: string;
	effects: Map<string, MockItemEffect>;
}

/** Every effect the rule managed to create, in order, with who it landed on. */
const appliedEffects: Array<{ target: unknown; effect: MockActiveEffect }> = [];

function conditionsAppliedTo(target: MockActor): string[] {
	return appliedEffects
		.filter((entry) => entry.target === target)
		.map((entry) => entry.effect.condition);
}

function lastAppliedEffect(): MockActiveEffect | undefined {
	return appliedEffects.at(-1)?.effect;
}

interface ApplyConditionSource {
	condition: string;
	trigger: ApplyConditionTrigger;
	effectId?: string;
	wounds?: number;
	attackSource?: 'any' | 'weapon' | 'spell';
	disabled?: boolean;
	label?: string;
	id?: string;
	identifier?: string;
	priority?: number;
	predicate?: Record<string, unknown>;
	type?: string;
}

interface ApplyConditionRuleTestInstance extends ApplyConditionRule {
	condition: string;
	trigger: ApplyConditionTrigger;
	effectId: string;
	wounds: number;
	attackSource: 'any' | 'weapon' | 'spell';
	disabled: boolean;
	label: string;
}

function createMockActor(): MockActor {
	const actor: MockActor = {
		isOwner: true,
		statuses: new Set<string>(),
		effects: [],
		deleteEmbeddedDocuments: vi.fn(async (_type: string, ids: string[]) => {
			actor.effects = actor.effects.filter((effect) => !ids.includes(effect.id ?? ''));
		}),
	};
	return actor;
}

/** Effects on the actor, the way a condition from another source or a by-hand toggle sits there. */
function addEffect(actor: MockActor, condition: string, id: string): MockActiveEffect {
	const effect: MockActiveEffect = {
		id,
		condition,
		statuses: new Set([condition]),
		sourceData: {},
		updateSource: () => {},
		getFlag: () => undefined,
	};
	actor.effects.push(effect);
	return effect;
}

function saveResolved(
	rule: ApplyConditionRule,
	actor: MockActor,
	outcome: 'pass' | 'fail' | 'unknown',
	messageId = 'card-1',
) {
	type Context = Parameters<ApplyConditionRule['onSaveResolved']>[0];
	return rule.onSaveResolved({
		actor: actor as unknown as Context['actor'],
		saveType: 'strength',
		outcome,
		messageId,
	});
}

function createMockItem(actor: MockActor): MockItem {
	return {
		actor,
		isEmbedded: true,
		name: 'Test Feature',
		uuid: 'test-item-uuid',
		effects: new Map(),
	};
}

function createApplyConditionRule(
	config: ApplyConditionSource,
	actor: MockActor,
	item: MockItem = createMockItem(actor),
): ApplyConditionRuleTestInstance {
	const sourceData = {
		condition: config.condition,
		trigger: config.trigger,
		effectId: config.effectId ?? '',
		wounds: config.wounds ?? 0,
		attackSource: config.attackSource ?? 'any',
		disabled: config.disabled ?? false,
		label: config.label ?? 'Test Apply Condition',
		id: config.id ?? 'test-apply-condition-id',
		identifier: config.identifier ?? '',
		priority: config.priority ?? 1,
		predicate: config.predicate ?? {},
		type: 'applyCondition',
	};

	const rule = new ApplyConditionRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			ApplyConditionRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as ApplyConditionRuleTestInstance;

	rule.condition = config.condition;
	rule.trigger = config.trigger;
	rule.effectId = sourceData.effectId;
	rule.wounds = sourceData.wounds;
	rule.attackSource = sourceData.attackSource;
	rule.id = sourceData.id;
	rule.disabled = config.disabled ?? false;
	rule.label = config.label ?? 'Test Apply Condition';

	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0 }),
		configurable: true,
	});

	return rule;
}

function buildItemUsedContext(
	sourceActor: MockActor,
	targetActor: MockActor | null,
	overrides: {
		isCritical?: boolean;
		isMiss?: boolean;
		itemType?: string;
	} = {},
) {
	const item = Object.assign(createMockItem(sourceActor), { type: overrides.itemType ?? 'weapon' });
	type Ctx = Parameters<ApplyConditionRule['onItemUsed']>[0];
	return {
		sourceItem: item as unknown as Ctx['sourceItem'],
		sourceActor: sourceActor as unknown as Ctx['sourceActor'],
		targetActor: targetActor as unknown as Ctx['targetActor'],
		card: null,
		isCritical: overrides.isCritical ?? false,
		isMiss: overrides.isMiss ?? false,
	};
}

describe('ApplyConditionRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hooksCall.mockReturnValue(true);
		appliedEffects.length = 0;

		fromStatusEffect.mockImplementation(async (condition: string) => {
			const sourceData: Record<string, unknown> = {};
			return {
				condition,
				statuses: new Set([condition]),
				sourceData,
				updateSource: (data: Record<string, unknown>) => Object.assign(sourceData, data),
			} satisfies MockActiveEffect;
		});

		createEffect.mockImplementation(
			async (effect: MockActiveEffect, { parent }: { parent: MockActor }) => {
				appliedEffects.push({ target: parent, effect });
				effect.id = `effect-${appliedEffects.length}`;
				effect.getFlag = (scope, key) =>
					(effect.sourceData[`flags.${scope}`] as Record<string, unknown> | undefined)?.[key];
				parent.effects.push(effect);
				return effect;
			},
		);
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ApplyConditionRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('condition');
			expect(schema).toHaveProperty('trigger');
			expect(schema).toHaveProperty('effectId');
			expect(schema).toHaveProperty('wounds');
			expect(schema).not.toHaveProperty('duration');
		});

		it('declares choices on the condition field (driven by CONFIG.NIMBLE.conditions)', () => {
			const schema = ApplyConditionRule.defineSchema();
			const condition = schema.condition as unknown as { choices: () => unknown };
			expect(typeof condition.choices).toBe('function');
		});

		it('returns the id-to-label object, so the select shows names rather than raw ids', () => {
			// SchemaFieldRenderer maps an array of ids to [id, id], which renders `soul_burned`.
			const schema = ApplyConditionRule.defineSchema();
			const condition = schema.condition as unknown as { choices: () => Record<string, string> };

			expect(condition.choices()).toBe(CONFIG.NIMBLE.conditions);
		});

		it('names each trigger with the words of Use an item for free, not its raw id', () => {
			const schema = ApplyConditionRule.defineSchema();
			const trigger = schema.trigger as unknown as { choices: Record<string, string> };

			expect(trigger.choices.onCritReceived).toBe(
				'NIMBLE.rules.useItemFree.triggers.choices.onCritReceived',
			);
			expect(Object.keys(trigger.choices)).toEqual([...TRIGGER_CHOICES]);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ApplyConditionRule.group).toBe('triggers');
			expect(ApplyConditionRule.description).toBe('NIMBLE.rules.applyCondition.description');
		});
	});

	describe('onItemUsed (fires per target on damage-apply)', () => {
		it('fires onCrit trigger only when context.isCritical is true', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor));
			expect(conditionsAppliedTo(targetActor)).toEqual([]);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));
			expect(conditionsAppliedTo(targetActor)).toEqual(['smoldering']);
		});

		it('follows the roll that stands, not a discarded crit that keeps its triggers', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed({
				...buildItemUsedContext(attackerActor, targetActor),
				discardedCritTriggers: true,
			});

			expect(conditionsAppliedTo(targetActor)).toEqual([]);
		});

		it('fires onHit trigger only when not critical', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onHit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));
			expect(conditionsAppliedTo(targetActor)).toEqual([]);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor));
			expect(conditionsAppliedTo(targetActor)).toEqual(['dazed']);
		});

		it('ignores events where the source actor is not the rule owner', async () => {
			const ownerActor = createMockActor();
			const otherActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				ownerActor,
			);

			// Event comes from a different actor's item — rule should not fire.
			await rule.onItemUsed(buildItemUsedContext(otherActor, targetActor, { isCritical: true }));

			expect(conditionsAppliedTo(targetActor)).toEqual([]);
		});

		it('no-ops gracefully when targetActor is null', async () => {
			const attackerActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'blinded', trigger: 'onCrit' },
				attackerActor,
			);

			await expect(
				rule.onItemUsed(buildItemUsedContext(attackerActor, null, { isCritical: true })),
			).resolves.not.toThrow();
		});
	});

	describe('self-target triggers', () => {
		it('fires onTurnStart only when the combatant actor owns the rule', async () => {
			const ownerActor = createMockActor();
			const otherActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onTurnStart' },
				ownerActor,
			);

			await rule.onTurnStart({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: otherActor as unknown as Parameters<ApplyConditionRule['onTurnStart']>[0]['actor'],
			});
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await rule.onTurnStart({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: ownerActor as unknown as Parameters<ApplyConditionRule['onTurnStart']>[0]['actor'],
			});
			expect(conditionsAppliedTo(ownerActor)).toEqual(['focused']);
		});

		it('fires onSpellCast on the caster for a spell of the mana it asks or more', async () => {
			const caster = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onSpellCast' },
				caster,
			);
			(rule as unknown as { manaAtLeast: number }).manaAtLeast = 2;
			type Ctx = Parameters<ApplyConditionRule['onItemActivated']>[0];
			const cast = (manaSpent: number, type = 'spell', actor: MockActor = caster) =>
				({ sourceItem: { type }, sourceActor: actor, card: null, manaSpent }) as unknown as Ctx;

			await rule.onItemActivated(cast(1));
			await rule.onItemActivated(cast(2, 'feature'));
			await rule.onItemActivated(cast(3, 'spell', createMockActor()));
			expect(conditionsAppliedTo(caster)).toEqual([]);

			await rule.onItemActivated(cast(2));
			expect(conditionsAppliedTo(caster)).toEqual(['focused']);
		});

		it('does not fire on a cast for a rule with another trigger', async () => {
			const caster = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onTurnStart' },
				caster,
			);
			type Ctx = Parameters<ApplyConditionRule['onItemActivated']>[0];

			await rule.onItemActivated({
				sourceItem: { type: 'spell' },
				sourceActor: caster,
				card: null,
				manaSpent: 5,
			} as unknown as Ctx);

			expect(conditionsAppliedTo(caster)).toEqual([]);
		});

		it('does not fire onTurnStart for a rule with a different trigger', async () => {
			const ownerActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onTurnEnd' },
				ownerActor,
			);

			await rule.onTurnStart({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: ownerActor as unknown as Parameters<ApplyConditionRule['onTurnStart']>[0]['actor'],
			});

			expect(conditionsAppliedTo(ownerActor)).toEqual([]);
		});

		it('fires onCritReceived on a crit against the owner, also a discarded crit that keeps its triggers', async () => {
			const ownerActor = createMockActor();
			const attackerActor = Object.assign(createMockActor(), { token: { disposition: -1 } });
			Object.assign(ownerActor, { token: { disposition: 1 } });
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onCritReceived' },
				ownerActor,
			);

			await rule.onAttackReceived(buildItemUsedContext(attackerActor, ownerActor));
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await rule.onAttackReceived(
				buildItemUsedContext(attackerActor, ownerActor, { isCritical: true }),
			);
			expect(conditionsAppliedTo(ownerActor)).toEqual(['focused']);

			const secondOwner = Object.assign(createMockActor(), { type: 'character' });
			const secondRule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onCritReceived' },
				secondOwner,
			);
			await secondRule.onAttackReceived({
				...buildItemUsedContext(attackerActor, secondOwner),
				discardedCritTriggers: true,
			});
			expect(conditionsAppliedTo(secondOwner)).toEqual(['focused']);
		});

		it('does not fire onCritReceived for a crit from an ally', async () => {
			const ownerActor = Object.assign(createMockActor(), { token: { disposition: 1 } });
			const allyActor = Object.assign(createMockActor(), { token: { disposition: 1 } });
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onCritReceived' },
				ownerActor,
			);

			await rule.onAttackReceived(
				buildItemUsedContext(allyActor, ownerActor, { isCritical: true }),
			);

			expect(conditionsAppliedTo(ownerActor)).toEqual([]);
		});

		it('does not fire onCritReceived for a crit against another creature', async () => {
			const ownerActor = createMockActor();
			const otherActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onCritReceived' },
				ownerActor,
			);

			await rule.onAttackReceived(
				buildItemUsedContext(ownerActor, otherActor, { isCritical: true }),
			);

			expect(conditionsAppliedTo(ownerActor)).toEqual([]);
			expect(conditionsAppliedTo(otherActor)).toEqual([]);
		});

		it('fires onDying when the owner starts Dying, and not for another creature', async () => {
			const ownerActor = createMockActor();
			const otherActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onDying' },
				ownerActor,
			);
			type Context = Parameters<ApplyConditionRule['onActorDying']>[0];
			const user = game.user;
			vi.stubGlobal('game', { ...game, user: { id: 'gm', isGM: true } });

			await rule.onActorDying({ actor: otherActor as unknown as Context['actor'], source: null });
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await rule.onActorDying({ actor: ownerActor as unknown as Context['actor'], source: null });
			vi.stubGlobal('game', { ...game, user });
			expect(conditionsAppliedTo(ownerActor)).toEqual(['focused']);
		});

		it('fires onDying only on the active GM, as every client sees it', async () => {
			const ownerActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onDying' },
				ownerActor,
			);
			type Context = Parameters<ApplyConditionRule['onActorDying']>[0];
			const user = game.user;
			vi.stubGlobal('game', { ...game, user: { id: 'player', isGM: false } });

			await rule.onActorDying({ actor: ownerActor as unknown as Context['actor'], source: null });
			vi.stubGlobal('game', { ...game, user });

			expect(conditionsAppliedTo(ownerActor)).toEqual([]);
		});

		it('fires onSaveFail only on failing outcome', async () => {
			const ownerActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'prone', trigger: 'onSaveFail' },
				ownerActor,
			);

			await saveResolved(rule, ownerActor, 'pass');
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await saveResolved(rule, ownerActor, 'fail');
			expect(conditionsAppliedTo(ownerActor)).toEqual(['prone']);
		});
	});

	describe('onSaveFail, when the same card later reports a success', () => {
		function createSaveRule(actor: MockActor, overrides: Partial<ApplyConditionSource> = {}) {
			return createApplyConditionRule(
				{ condition: 'prone', trigger: 'onSaveFail', ...overrides },
				actor,
			);
		}

		it('stores the card, the item and the condition on the effect', async () => {
			const actor = createMockActor();
			await saveResolved(createSaveRule(actor), actor, 'fail');

			expect(lastAppliedEffect()?.sourceData[`flags.${SYSTEM_ID}`]).toEqual({
				saveFailSource: { messageId: 'card-1', itemUuid: 'test-item-uuid', condition: 'prone' },
			});
		});

		it('removes the condition it added from that card', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail');
			expect(actor.effects).toHaveLength(1);

			await saveResolved(rule, actor, 'pass');
			expect(actor.effects).toHaveLength(0);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith(
				'ActiveEffect',
				expect.any(Array),
				{ [UNDO_APPLICATION_OPTION]: true },
			);
		});

		describe('with Feature Effects off', () => {
			const globals = globalThis as unknown as { game: { settings?: unknown } };
			let saved: unknown;

			beforeEach(() => {
				saved = globals.game.settings;
			});

			afterEach(() => {
				globals.game.settings = saved;
			});

			it('still gets the save result, to take back its own condition', () => {
				expect(ApplyConditionRule.alwaysDispatchedEvents).toContain('onSaveResolved');
			});

			it('adds nothing on a fail, and removes its condition on a success', async () => {
				const actor = createMockActor();
				const rule = createSaveRule(actor);
				await saveResolved(rule, actor, 'fail');
				expect(actor.effects).toHaveLength(1);

				globals.game.settings = { get: () => false };
				await saveResolved(rule, actor, 'pass');
				expect(actor.effects).toHaveLength(0);

				await saveResolved(rule, actor, 'fail', 'card-2');
				expect(actor.effects).toHaveLength(0);
			});
		});

		it('removes the condition it added when the result stops being known', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail');
			expect(actor.effects).toHaveLength(1);

			await saveResolved(rule, actor, 'unknown');
			expect(actor.effects).toHaveLength(0);
		});

		it('leaves a condition of another kind from another source alone', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);
			addEffect(actor, 'dazed', 'other');

			await saveResolved(rule, actor, 'fail');
			await saveResolved(rule, actor, 'pass');

			expect(actor.effects.map((effect) => effect.id)).toEqual(['other']);
		});

		it('does not remove a condition the actor already had', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);
			addEffect(actor, 'prone', 'held-before');

			await saveResolved(rule, actor, 'fail');
			expect(conditionsAppliedTo(actor)).toEqual([]);

			await saveResolved(rule, actor, 'pass');
			expect(actor.effects.map((effect) => effect.id)).toEqual(['held-before']);
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('does not remove a same-kind condition gained after this one was taken off', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail');
			actor.effects = [];
			addEffect(actor, 'prone', 'by-hand');

			await saveResolved(rule, actor, 'pass');
			expect(actor.effects.map((effect) => effect.id)).toEqual(['by-hand']);
		});

		it('does not remove what it added from another card', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail', 'card-1');
			await saveResolved(rule, actor, 'pass', 'card-2');

			expect(actor.effects).toHaveLength(1);
		});

		it('does not remove what another rule added from the same card', async () => {
			const actor = createMockActor();
			const first = createSaveRule(actor);
			const second = createSaveRule(actor, { condition: 'dazed' });

			await saveResolved(first, actor, 'fail');
			await saveResolved(second, actor, 'fail');
			await saveResolved(first, actor, 'pass');

			expect(actor.effects.map((effect) => effect.condition)).toEqual(['dazed']);
		});

		it('removes it through a rule built again after a reload, with a new id', async () => {
			const actor = createMockActor();

			await saveResolved(createSaveRule(actor, { id: 'before-reload' }), actor, 'fail');
			await saveResolved(createSaveRule(actor, { id: 'after-reload' }), actor, 'pass');

			expect(actor.effects).toHaveLength(0);
		});

		it('does not remove what a rule of another item added from the same card', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);
			await saveResolved(rule, actor, 'fail');

			const otherRule = createSaveRule(actor);
			Object.defineProperty(otherRule, 'parent', {
				get: () => ({ ...createMockItem(actor), uuid: 'other-item-uuid' }),
			});
			await saveResolved(otherRule, actor, 'pass');

			expect(actor.effects).toHaveLength(1);
		});

		it('adds the condition again when the card fails again', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail');
			await saveResolved(rule, actor, 'pass');
			await saveResolved(rule, actor, 'fail');

			expect(actor.effects.map((effect) => effect.condition)).toEqual(['prone']);
		});

		it('removes its condition even after the rule was disabled', async () => {
			const actor = createMockActor();
			const rule = createSaveRule(actor);

			await saveResolved(rule, actor, 'fail');
			rule.disabled = true;
			await saveResolved(rule, actor, 'pass');

			expect(actor.effects).toHaveLength(0);
		});

		it('applies nothing on a failed save while the rule is disabled', async () => {
			const actor = createMockActor();

			await saveResolved(createSaveRule(actor, { disabled: true }), actor, 'fail');

			expect(actor.effects).toHaveLength(0);
		});

		it('ignores a save of another actor', async () => {
			const owner = createMockActor();
			const other = createMockActor();

			await saveResolved(createSaveRule(owner), other, 'fail');

			expect(owner.effects).toHaveLength(0);
			expect(other.effects).toHaveLength(0);
		});
	});

	describe('with an item effect', () => {
		const globals = globalThis as { fromUuid?: unknown };
		let previousFromUuid: unknown;
		beforeEach(() => {
			previousFromUuid = globals.fromUuid;
			globals.fromUuid = async (uuid: string) => ({ uuid });
		});
		afterEach(() => {
			globals.fromUuid = previousFromUuid;
		});

		const markEffect = (transfer = false): MockItemEffect => ({
			transfer,
			toObject: () => ({
				_id: 'fx',
				name: 'Marked',
				statuses: ['dazed'],
				origin: 'elsewhere',
				transfer,
				system: { lastsUntil: [{ kind: 'turn', boundary: 'end', clock: 'holder' }] },
			}),
		});

		function ruleWithEffect(
			actor: MockActor,
			trigger: ApplyConditionTrigger,
			effect: MockItemEffect = markEffect(),
		) {
			const item = createMockItem(actor);
			item.effects.set('fx', effect);
			return createApplyConditionRule(
				{ condition: 'smoldering', trigger, effectId: 'fx' },
				actor,
				item,
			);
		}

		const wounded = (actor: MockActor) => ({
			actor: actor as unknown as Parameters<ApplyConditionRule['onActorWounded']>[0]['actor'],
			previousHp: 10,
			currentHp: 5,
		});

		it('puts a copy of the effect on the owner of a self trigger, with the item as its source', async () => {
			const owner = createMockActor();

			await ruleWithEffect(owner, 'onWound').onActorWounded(wounded(owner));

			expect(conditionsAppliedTo(owner)).toEqual(['dazed']);
			expect(lastAppliedEffect()?.sourceData).toMatchObject({
				name: 'Marked',
				origin: 'test-item-uuid',
				statuses: ['dazed'],
				system: { lastsUntil: [{ kind: 'turn', boundary: 'end', clock: 'holder' }] },
			});
		});

		it('puts a copy of the effect on the target of an attack trigger', async () => {
			const attacker = createMockActor();
			const target = createMockActor();

			await ruleWithEffect(attacker, 'onCrit').onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true }),
			);

			expect(conditionsAppliedTo(target)).toEqual(['dazed']);
			expect(lastAppliedEffect()?.sourceData).toMatchObject({
				name: 'Marked',
				origin: 'test-item-uuid',
			});
		});

		it('names the card of the attack or of the failed save, so the lines of the effect go on it', async () => {
			const attacker = createMockActor();
			const target = createMockActor();
			const createOptions = () => createEffect.mock.calls.at(-1)?.[1] as Record<string, unknown>;

			await ruleWithEffect(attacker, 'onCrit').onItemUsed({
				...buildItemUsedContext(attacker, target, { isCritical: true }),
				card: { id: 'attack-card' } as never,
			});
			expect(createOptions()).toMatchObject({ [SYSTEM_ID]: { effectCardId: 'attack-card' } });

			const owner = createMockActor();
			await saveResolved(ruleWithEffect(owner, 'onSaveFail'), owner, 'fail');
			expect(createOptions()).toMatchObject({ [SYSTEM_ID]: { effectCardId: 'card-1' } });
		});

		it('gives the bare condition when the rule names no effect', async () => {
			const owner = createMockActor();
			const rule = createApplyConditionRule({ condition: 'slowed', trigger: 'onWound' }, owner);

			await rule.onActorWounded(wounded(owner));

			expect(conditionsAppliedTo(owner)).toEqual(['slowed']);
			expect(lastAppliedEffect()?.sourceData).not.toHaveProperty('name');
			expect(lastAppliedEffect()?.sourceData).not.toHaveProperty('duration');
		});

		it('gives the bare condition when the effect goes on the item owner itself', async () => {
			const owner = createMockActor();

			await ruleWithEffect(owner, 'onWound', markEffect(true)).onActorWounded(wounded(owner));

			expect(conditionsAppliedTo(owner)).toEqual(['smoldering']);
		});

		it('marks the copy of a failed save, and a pass takes it back', async () => {
			const owner = createMockActor();
			const rule = ruleWithEffect(owner, 'onSaveFail');

			await saveResolved(rule, owner, 'fail');
			const copy = owner.effects[0] as MockActiveEffect;
			const flags = copy.sourceData.flags as Record<string, Record<string, unknown>>;
			expect(flags[SYSTEM_ID]?.saveFailSource).toEqual({
				messageId: 'card-1',
				itemUuid: 'test-item-uuid',
				condition: 'smoldering',
			});

			// The copy carries its flags as a nested object, as a created effect does.
			copy.getFlag = (scope, key) => flags[scope]?.[key];
			await saveResolved(rule, owner, 'pass');
			expect(owner.effects).toHaveLength(0);
		});
	});

	describe('the Apply to Targets step of the same effect on the card', () => {
		const globals = globalThis as { fromUuid?: unknown };
		let previousFromUuid: unknown;
		beforeEach(() => {
			previousFromUuid = globals.fromUuid;
			globals.fromUuid = async (uuid: string) => ({ uuid });
			const created = createEffect.getMockImplementation();
			createEffect.mockImplementation(async (effect: MockActiveEffect, operation) => {
				const made = await created?.(effect, operation);
				const parent = (operation as { parent: { uuid?: string } }).parent;
				return Object.assign(made, { uuid: `${parent.uuid}.ActiveEffect.${made.id}` });
			});
		});
		afterEach(() => {
			globals.fromUuid = previousFromUuid;
		});

		const goblin = () => Object.assign(createMockActor(), { uuid: 'Actor.goblin', name: 'Goblin' });
		const attackCard = () => {
			const card = {
				id: 'attack-card',
				flags: {} as Record<string, unknown>,
				// The write lands a tick later, as a database write does.
				update: vi.fn(async (data: Record<string, unknown>) => {
					await new Promise((resolve) => setTimeout(resolve, 1));
					for (const [path, value] of Object.entries(data)) {
						foundry.utils.setProperty(card, path, value);
					}
				}),
			};
			return card;
		};
		const recordOf = (card: ReturnType<typeof attackCard>) =>
			foundry.utils.getProperty(
				card,
				`flags.${SYSTEM_ID}.appliedEffects.apply-condition-test-apply-condition-id`,
			);

		function ruleWithEffect(attacker: MockActor) {
			const item = createMockItem(attacker);
			item.effects.set('fx', {
				transfer: false,
				toObject: () => ({ _id: 'fx', name: 'Marked', statuses: ['dazed'], system: {} }),
			});
			return createApplyConditionRule(
				{ condition: '', trigger: 'onHit', effectId: 'fx' },
				attacker,
				item,
			);
		}

		it('records the target the effect went on, so the step shows it applied', async () => {
			const attacker = createMockActor();
			const target = goblin();
			const card = attackCard();

			await ruleWithEffect(attacker).onItemUsed({
				...buildItemUsedContext(attacker, target),
				card: card as never,
			});

			expect(recordOf(card)).toEqual([
				{ effectUuid: 'Actor.goblin.ActiveEffect.effect-1', actorName: 'Goblin' },
			]);
		});

		it('records the target of a bare condition', async () => {
			const attacker = createMockActor();
			const target = goblin();
			const card = attackCard();
			const rule = createApplyConditionRule({ condition: 'prone', trigger: 'onCrit' }, attacker);

			await rule.onItemUsed({
				...buildItemUsedContext(attacker, target, { isCritical: true }),
				card: card as never,
			});

			expect(recordOf(card)).toEqual([
				{ effectUuid: 'Actor.goblin.ActiveEffect.effect-1', actorName: 'Goblin' },
			]);
		});

		it('adds each target to the record as its damage is applied', async () => {
			const attacker = createMockActor();
			const card = attackCard();
			const rule = ruleWithEffect(attacker);
			const kobold = Object.assign(createMockActor(), { uuid: 'Actor.kobold', name: 'Kobold' });

			await Promise.all([
				rule.onItemUsed({ ...buildItemUsedContext(attacker, goblin()), card: card as never }),
				rule.onItemUsed({ ...buildItemUsedContext(attacker, kobold), card: card as never }),
			]);

			expect(
				(recordOf(card) as Array<{ actorName: string }>).map((entry) => entry.actorName),
			).toEqual(['Goblin', 'Kobold']);
		});

		it('records nothing when the condition did not go on, so the step keeps its button', async () => {
			hooksCall.mockReturnValue(false);
			const attacker = createMockActor();
			const card = attackCard();
			const rule = createApplyConditionRule({ condition: 'prone', trigger: 'onHit' }, attacker);

			await rule.onItemUsed({ ...buildItemUsedContext(attacker, goblin()), card: card as never });

			expect(card.update).not.toHaveBeenCalled();
		});

		it('records nothing on a self trigger, which has no step on the card', async () => {
			const owner = Object.assign(createMockActor(), { uuid: 'Actor.owner', name: 'Owner' });
			const rule = createApplyConditionRule({ condition: 'prone', trigger: 'onTurnStart' }, owner);
			type Ctx = Parameters<ApplyConditionRule['onTurnStart']>[0];

			await rule.onTurnStart({ actor: owner } as unknown as Ctx);

			expect(conditionsAppliedTo(owner)).toEqual(['prone']);
		});
	});

	describe('on an Active Effect', () => {
		const globals = globalThis as { fromUuidSync?: unknown };
		let previous: unknown;
		beforeEach(() => {
			previous = globals.fromUuidSync;
			globals.fromUuidSync = () => null;
		});
		afterEach(() => {
			globals.fromUuidSync = previous;
		});

		function asActor(actor: MockActor): MockActor {
			return Object.assign(Object.create(Actor.prototype), actor) as MockActor;
		}

		function ruleOnEffect(holder: MockActor, caster: MockActor) {
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onTurnStart' },
				caster,
			);
			const effect = {
				documentName: 'ActiveEffect',
				uuid: 'Actor.holder.ActiveEffect.e',
				name: 'Focus Spell',
				parent: holder,
				target: holder,
				origin: 'test-item-uuid',
			};
			Object.defineProperty(rule, 'parent', { get: () => effect, configurable: true });
			return rule;
		}

		const turnStart = (actor: MockActor) => ({
			combat: {} as Combat,
			combatant: {} as Combatant,
			actor: actor as unknown as Parameters<ApplyConditionRule['onTurnStart']>[0]['actor'],
		});

		it('fires on the turn of the creature with the effect, and gives it the condition', async () => {
			const holder = asActor(createMockActor());
			const caster = asActor(createMockActor());
			const rule = ruleOnEffect(holder, caster);

			await rule.onTurnStart(turnStart(caster));
			expect(appliedEffects).toHaveLength(0);

			await rule.onTurnStart(turnStart(holder));
			expect(conditionsAppliedTo(holder)).toEqual(['focused']);
			expect(conditionsAppliedTo(caster)).toEqual([]);
		});
	});

	describe('source recording', () => {
		it('records the owning item as the origin of the applied effect', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();

			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(lastAppliedEffect()?.sourceData.origin).toBe('test-item-uuid');
		});
	});

	describe('predicate gating', () => {
		it('skips application when disabled', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit', disabled: true },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(conditionsAppliedTo(targetActor)).toEqual([]);
		});
	});

	describe('getActivationCardNodes', () => {
		it('returns an Apply Effect node with the condition', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule({ condition: 'smoldering', trigger: 'onCrit' }, actor);

			const nodes = rule.getActivationCardNodes({ isCritical: true, isMiss: false });

			expect(nodes).toHaveLength(1);
			expect(nodes[0]).toMatchObject({
				type: 'applyEffect',
				effectId: null,
				effectItemUuid: null,
				condition: 'smoldering',
				recipient: 'targets',
			});
			expect(nodes[0]).not.toHaveProperty('duration');
			expect(nodes[0]?.id).toContain('apply-condition-');
		});

		it('names the item effect and its item, so the card applies a copy of it', () => {
			const actor = createMockActor();
			const item = createMockItem(actor);
			item.effects.set('fx', { transfer: false, toObject: () => ({}) });
			const rule = createApplyConditionRule(
				{ condition: '', trigger: 'onHit', effectId: 'fx' },
				actor,
				item,
			);

			const nodes = rule.getActivationCardNodes({ isCritical: false, isMiss: false });

			expect(nodes).toHaveLength(1);
			expect(nodes[0]).toMatchObject({
				type: 'applyEffect',
				effectId: 'fx',
				effectItemUuid: 'test-item-uuid',
				recipient: 'targets',
			});
		});

		it('names no effect when the item no longer has it', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onHit', effectId: 'gone' },
				actor,
			);

			const [node] = rule.getActivationCardNodes({ isCritical: false, isMiss: false });

			expect(node).toMatchObject({ effectId: null, condition: 'smoldering' });
		});

		it('returns nothing when the trigger does not match the context', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule({ condition: 'smoldering', trigger: 'onCrit' }, actor);

			expect(rule.getActivationCardNodes({ isCritical: false, isMiss: false })).toEqual([]);
			expect(rule.getActivationCardNodes({ isCritical: false, isMiss: true })).toEqual([]);
		});

		it('adds a Wound row for the targets, also with no condition and no effect', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule({ condition: '', trigger: 'onHit', wounds: 1 }, actor);

			expect(rule.getActivationCardNodes({ isCritical: false, isMiss: false })).toEqual([
				{
					id: 'wound-test-apply-condition-id',
					type: 'wound',
					amount: 1,
					recipient: 'targets',
					parentContext: null,
					parentNode: null,
				},
			]);
		});

		it('adds the Wound row after the condition row, and none with 0 Wounds', () => {
			const actor = createMockActor();
			const both = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onHit', wounds: 2 },
				actor,
			);
			const conditionOnly = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onHit' },
				actor,
			);
			const context = { isCritical: false, isMiss: false };

			expect(both.getActivationCardNodes(context).map((node) => node.type)).toEqual([
				'applyEffect',
				'wound',
			]);
			expect(conditionOnly.getActivationCardNodes(context).map((node) => node.type)).toEqual([
				'applyEffect',
			]);
		});

		it('returns nothing for non-attack triggers', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onTurnStart' },
				actor,
			);

			expect(rule.getActivationCardNodes({ isCritical: true, isMiss: false })).toEqual([]);
		});
	});

	describe('attack source', () => {
		it('has an Any source by default, with the choices any, weapon and spell', () => {
			const field = ApplyConditionRule.defineSchema().attackSource as unknown as {
				initial: string;
				choices: Record<string, string>;
			};

			expect(field.initial).toBe('any');
			expect(Object.keys(field.choices)).toEqual(['any', 'weapon', 'spell']);
		});

		it('with Any, a spell crit still applies the condition', async () => {
			const attacker = createMockActor();
			const target = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attacker,
			);

			await rule.onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true, itemType: 'spell' }),
			);

			expect(conditionsAppliedTo(target)).toEqual(['smoldering']);
			expect(
				rule.getActivationCardNodes({
					isCritical: true,
					isMiss: false,
					sourceItem: { type: 'spell' },
				}),
			).toHaveLength(1);
		});

		it('with Weapon, a weapon crit applies the condition and a spell crit does not', async () => {
			const attacker = createMockActor();
			const target = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit', attackSource: 'weapon' },
				attacker,
			);

			await rule.onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true, itemType: 'spell' }),
			);
			expect(conditionsAppliedTo(target)).toEqual([]);

			await rule.onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true, itemType: 'weapon' }),
			);
			expect(conditionsAppliedTo(target)).toEqual(['smoldering']);
		});

		it('with Weapon, the card of a spell crit gets no row, and that of a weapon crit does', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit', attackSource: 'weapon' },
				actor,
			);
			const crit = { isCritical: true, isMiss: false };

			expect(rule.getActivationCardNodes({ ...crit, sourceItem: { type: 'spell' } })).toEqual([]);
			expect(rule.getActivationCardNodes({ ...crit, sourceItem: { type: 'weapon' } })).toHaveLength(
				1,
			);
		});

		it('with Spell, only a spell crit counts', async () => {
			const attacker = createMockActor();
			const target = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit', attackSource: 'spell' },
				attacker,
			);

			await rule.onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true, itemType: 'weapon' }),
			);
			expect(conditionsAppliedTo(target)).toEqual([]);
			await rule.onItemUsed(
				buildItemUsedContext(attacker, target, { isCritical: true, itemType: 'spell' }),
			);
			expect(conditionsAppliedTo(target)).toEqual(['smoldering']);
		});

		it('limits a crit received to the source of the attack against the holder', async () => {
			const owner = Object.assign(createMockActor(), { token: { disposition: 1 } });
			const attacker = Object.assign(createMockActor(), { token: { disposition: -1 } });
			const rule = createApplyConditionRule(
				{ condition: 'focused', trigger: 'onCritReceived', attackSource: 'weapon' },
				owner,
			);

			await rule.onAttackReceived(
				buildItemUsedContext(attacker, owner, { isCritical: true, itemType: 'spell' }),
			);
			expect(conditionsAppliedTo(owner)).toEqual([]);
			await rule.onAttackReceived(
				buildItemUsedContext(attacker, owner, { isCritical: true, itemType: 'weapon' }),
			);
			expect(conditionsAppliedTo(owner)).toEqual(['focused']);
		});
	});

	describe('Wounds', () => {
		function hero(value: number) {
			const actor = Object.assign(createMockActor(), {
				uuid: 'Actor.tessa',
				name: 'Tessa',
				system: { attributes: { wounds: { value, max: 6 } } },
				update: vi.fn(async (_data: Record<string, unknown>) => undefined as unknown),
			});
			return actor;
		}

		it('gives the target its Wounds when the attack lands, and records them on the card', async () => {
			const attacker = createMockActor();
			const target = hero(1);
			const card = { id: 'card-1', update: vi.fn(async () => undefined) };
			const rule = createApplyConditionRule(
				{ condition: '', trigger: 'onHit', wounds: 1 },
				attacker,
			);

			await rule.onItemUsed({
				...buildItemUsedContext(attacker, target),
				card: card as never,
			});

			expect(target.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 2 });
			expect(card.update).toHaveBeenCalledWith({
				[`flags.${SYSTEM_ID}.appliedWounds.wound-test-apply-condition-id.Actor_tessa`]: {
					actorName: 'Tessa',
					before: 1,
					after: 2,
				},
			});
		});

		it('gives the condition and the Wounds together', async () => {
			const attacker = createMockActor();
			const target = hero(0);
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onHit', wounds: 2 },
				attacker,
			);

			await rule.onItemUsed(buildItemUsedContext(attacker, target));

			expect(conditionsAppliedTo(target)).toEqual(['dazed']);
			expect(target.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 2 });
		});

		it('gives its own holder the Wounds on a trigger of its own', async () => {
			const holder = hero(3);
			const rule = createApplyConditionRule(
				{ condition: '', trigger: 'onTurnStart', wounds: 1 },
				holder,
			);
			type Ctx = Parameters<ApplyConditionRule['onTurnStart']>[0];

			await rule.onTurnStart({ actor: holder } as unknown as Ctx);

			expect(holder.update).toHaveBeenCalledWith({ 'system.attributes.wounds.value': 4 });
		});

		describe('on a failed save that a reroll turns into a success', () => {
			const globals = globalThis as unknown as { game: { messages?: unknown } };
			let savedMessages: unknown;
			let saveCards: Map<
				string,
				{ flags: Record<string, unknown>; update: ReturnType<typeof vi.fn> }
			>;

			function saveCard(id: string) {
				const card = {
					flags: {} as Record<string, unknown>,
					update: vi.fn(async (changes: Record<string, unknown>) => {
						for (const [path, value] of Object.entries(changes)) {
							foundry.utils.setProperty(card, path, value);
						}
					}),
				};
				saveCards.set(id, card);
				return card;
			}

			function woundsOf(actor: ReturnType<typeof hero>) {
				return actor.system.attributes.wounds.value;
			}

			function trackingHero(value: number) {
				const actor = hero(value);
				actor.update.mockImplementation(async (data: Record<string, unknown>) => {
					actor.system.attributes.wounds.value = data['system.attributes.wounds.value'] as number;
				});
				return actor;
			}

			beforeEach(() => {
				savedMessages = globals.game.messages;
				saveCards = new Map();
				globals.game.messages = { get: (id: string) => saveCards.get(id) };
				saveCard('card-1');
				saveCard('card-2');
			});

			afterEach(() => {
				globals.game.messages = savedMessages;
			});

			it('takes back the Wounds that the fail gave, with its condition', async () => {
				const actor = trackingHero(1);
				const rule = createApplyConditionRule(
					{ condition: 'prone', trigger: 'onSaveFail', wounds: 2 },
					actor,
				);

				await saveResolved(rule, actor as never, 'fail');
				expect(woundsOf(actor)).toBe(3);

				await saveResolved(rule, actor as never, 'pass');
				expect(woundsOf(actor)).toBe(1);
				expect(actor.effects).toHaveLength(0);

				await saveResolved(rule, actor as never, 'unknown');
				expect(woundsOf(actor)).toBe(1);
			});

			it('takes back no more than it gave, never below 0, and only from its own card', async () => {
				const actor = trackingHero(5);
				const rule = createApplyConditionRule(
					{ condition: '', trigger: 'onSaveFail', wounds: 3 },
					actor,
				);

				await saveResolved(rule, actor as never, 'fail');
				expect(woundsOf(actor)).toBe(6);

				await saveResolved(rule, actor as never, 'pass', 'card-2');
				expect(woundsOf(actor)).toBe(6);

				actor.system.attributes.wounds.value = 0;
				await saveResolved(rule, actor as never, 'pass');
				expect(woundsOf(actor)).toBe(0);

				actor.system.attributes.wounds.value = 4;
				await saveResolved(rule, actor as never, 'fail');
				await saveResolved(rule, actor as never, 'pass');
				expect(woundsOf(actor)).toBe(4);
			});
		});

		it('gives no Wounds with 0, as before', async () => {
			const attacker = createMockActor();
			const target = hero(1);
			const rule = createApplyConditionRule({ condition: 'dazed', trigger: 'onHit' }, attacker);

			await rule.onItemUsed(buildItemUsedContext(attacker, target));

			expect(target.update).not.toHaveBeenCalled();
		});
	});

	describe('dedupe against existing condition', () => {
		it('does not re-apply when target already has the condition', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			targetActor.statuses.add('smoldering');

			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(conditionsAppliedTo(targetActor)).toEqual([]);
		});
	});

	describe('nimble.preApplyCondition hook', () => {
		it('calls Hooks.call before applying the condition', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCall).toHaveBeenCalledWith(
				'nimble.preApplyCondition',
				expect.objectContaining({ target: targetActor, condition: 'dazed' }),
			);
			expect(conditionsAppliedTo(targetActor)).toEqual(['dazed']);
		});

		it('skips application when a listener returns false', async () => {
			hooksCall.mockReturnValue(false);
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCall).toHaveBeenCalledWith(
				'nimble.preApplyCondition',
				expect.objectContaining({ condition: 'dazed' }),
			);
			expect(conditionsAppliedTo(targetActor)).toEqual([]);
		});
	});

	describe('nimble.conditionApplied hook', () => {
		it('fires Hooks.callAll after successfully applying a condition', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCallAll).toHaveBeenCalledWith(
				'nimble.conditionApplied',
				expect.objectContaining({
					target: targetActor,
					condition: 'smoldering',
					effect: lastAppliedEffect(),
				}),
			);
		});

		it('does not fire when the effect could not be created', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			createEffect.mockResolvedValue(undefined);
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCallAll).not.toHaveBeenCalled();
		});

		it('does not fire when preApplyCondition blocks application', async () => {
			hooksCall.mockReturnValue(false);
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCallAll).not.toHaveBeenCalledWith('nimble.conditionApplied', expect.anything());
		});
	});
});

describe('ApplyConditionRule effect picker words', () => {
	const recipientOf = (trigger: string) => {
		const field = ApplyConditionRule.defineSchema().effectId as unknown as {
			options: { recipient: (data: Record<string, unknown>) => string };
		};
		return field.options.recipient({ trigger });
	};

	it('reads the Lasts Until for the targets on an attack outcome', () => {
		expect(recipientOf('onHit')).toBe('targets');
	});

	it('reads the Lasts Until for the rule actor on a self trigger', () => {
		expect(recipientOf('onTurnStart')).toBe('self');
	});
});
