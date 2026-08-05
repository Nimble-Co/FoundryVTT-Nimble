import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import { ApplyConditionRule, type ApplyConditionTrigger } from './applyCondition.js';

interface MockActiveEffect {
	condition: string;
	statuses: Set<string>;
	/** What `updateSource` has folded in, standing for the effect's own source data. */
	sourceData: Record<string, unknown>;
	updateSource(data: Record<string, unknown>): void;
}

interface MockActor {
	statuses: Set<string>;
	effects: MockActiveEffect[];
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
	return { statuses: new Set<string>(), effects: [] };
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
	Object.defineProperty(rule, '_predicate', {
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
			async (effect: MockActiveEffect, { parent }: { parent: unknown }) => {
				appliedEffects.push({ target: parent, effect });
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
			const condition = schema.condition as unknown as { choices: () => string[] };
			expect(typeof condition.choices).toBe('function');
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

			await rule.onSaveResolved({
				actor: ownerActor as unknown as Parameters<
					ApplyConditionRule['onSaveResolved']
				>[0]['actor'],
				saveType: 'strength',
				outcome: 'pass',
			});
			expect(conditionsAppliedTo(ownerActor)).toEqual([]);

			await rule.onSaveResolved({
				actor: ownerActor as unknown as Parameters<
					ApplyConditionRule['onSaveResolved']
				>[0]['actor'],
				saveType: 'strength',
				outcome: 'fail',
			});
			expect(conditionsAppliedTo(ownerActor)).toEqual(['prone']);
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

			expect(lastAppliedEffect()?.sourceData.duration).toEqual({ rounds: 2 });
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

		it('passes a null effect when the effect could not be created', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			createEffect.mockResolvedValue(undefined);
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(hooksCallAll).toHaveBeenCalledWith(
				'nimble.conditionApplied',
				expect.objectContaining({ condition: 'dazed', effect: null }),
			);
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
