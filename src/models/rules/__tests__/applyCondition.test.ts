import { beforeEach, describe, expect, it, vi } from 'vitest';

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
	statuses: Set<string>;
	effects: MockActiveEffect[];
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

interface MockItem {
	actor: MockActor;
	isEmbedded: boolean;
	name: string;
	uuid: string;
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
	duration?: { rounds?: number | null; turns?: number | null; seconds?: number | null };
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
	duration: { rounds: number | null; turns: number | null; seconds: number | null };
	disabled: boolean;
	label: string;
}

function createMockActor(): MockActor {
	const actor: MockActor = {
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
	return { actor, isEmbedded: true, name: 'Test Feature', uuid: 'test-item-uuid' };
}

function createApplyConditionRule(
	config: ApplyConditionSource,
	actor: MockActor,
): ApplyConditionRuleTestInstance {
	const item = createMockItem(actor);
	const sourceData = {
		condition: config.condition,
		trigger: config.trigger,
		duration: {
			rounds: config.duration?.rounds ?? null,
			turns: config.duration?.turns ?? null,
			seconds: config.duration?.seconds ?? null,
		},
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
	rule.duration = sourceData.duration;
	rule.disabled = config.disabled ?? false;
	rule.label = config.label ?? 'Test Apply Condition';

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
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
			expect(schema).toHaveProperty('duration');
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
			Object.defineProperty(otherRule, 'item', {
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

	describe('duration pass-through', () => {
		it('stamps the configured duration on the applied effect', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();

			const rule = createApplyConditionRule(
				{
					condition: 'smoldering',
					trigger: 'onCrit',
					duration: { rounds: 2 },
				},
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(lastAppliedEffect()?.sourceData.duration).toEqual({
				value: 2,
				units: 'rounds',
				expiry: 'turnStart',
			});
		});

		it('stamps the configured duration on a condition applied to the owner', async () => {
			const ownerActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'slowed', trigger: 'onWound', duration: { turns: 1 } },
				ownerActor,
			);

			await rule.onActorWounded({
				actor: ownerActor as unknown as Parameters<
					ApplyConditionRule['onActorWounded']
				>[0]['actor'],
				previousHp: 10,
				currentHp: 5,
			});

			expect(lastAppliedEffect()?.sourceData.duration).toEqual({
				value: 1,
				units: 'turns',
				expiry: 'turnStart',
			});
		});

		it('leaves the duration alone when no duration fields are set', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();

			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(lastAppliedEffect()?.sourceData).not.toHaveProperty('duration');
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
		it('returns a condition node when the trigger matches the context', () => {
			const actor = createMockActor();
			const rule = createApplyConditionRule({ condition: 'smoldering', trigger: 'onCrit' }, actor);

			const nodes = rule.getActivationCardNodes({ isCritical: true, isMiss: false });

			expect(nodes).toHaveLength(1);
			const first = nodes[0] as { type: string; condition: string; id: string } | undefined;
			expect(first?.type).toBe('condition');
			expect(first?.condition).toBe('smoldering');
			expect(first?.id).toContain('apply-condition-');
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
