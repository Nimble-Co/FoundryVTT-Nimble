import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import { SYSTEM_ID } from '#system';
import { ApplyConditionRule, type ApplyConditionTrigger } from '../applyCondition.js';

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
	} = {},
) {
	const item = createMockItem(sourceActor);
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
			const attackerActor = createMockActor();
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

			const secondOwner = createMockActor();
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

			await rule.onActorDying({ actor: otherActor as unknown as Context['actor'], source: null });
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await rule.onActorDying({ actor: ownerActor as unknown as Context['actor'], source: null });
			expect(conditionsAppliedTo(ownerActor)).toEqual(['focused']);
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

		it('returns nothing for non-attack triggers', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onTurnStart' },
				actor,
			);

			expect(rule.getActivationCardNodes({ isCritical: true, isMiss: false })).toEqual([]);
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
