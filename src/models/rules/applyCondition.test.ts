import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hooksCall = vi.fn().mockReturnValue(true);
const hooksCallAll = vi.fn();
vi.stubGlobal('Hooks', { call: hooksCall, callAll: hooksCallAll });

import { ApplyConditionRule, type ApplyConditionTrigger } from './applyCondition.js';

interface MockActiveEffect {
	update: Mock<(data: Record<string, unknown>) => Promise<unknown>>;
}

interface MockActor {
	statuses: Set<string>;
	toggleStatusEffect: Mock<
		(
			statusId: string,
			options?: { active?: boolean },
		) => Promise<MockActiveEffect | boolean | undefined>
	>;
}

interface MockItem {
	actor: MockActor;
	isEmbedded: boolean;
	name: string;
	uuid: string;
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
	return {
		statuses: new Set<string>(),
		toggleStatusEffect: vi.fn().mockResolvedValue(true),
	};
}

function createMockActorWithAppliedEffect(effectUpdate: Mock): MockActor {
	return {
		statuses: new Set<string>(),
		toggleStatusEffect: vi.fn().mockResolvedValue({ update: effectUpdate }),
	};
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
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ApplyConditionRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('condition');
			expect(schema).toHaveProperty('trigger');
			expect(schema).toHaveProperty('duration');
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
			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));
			expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('smoldering', { active: true });
		});

		it('fires onHit trigger only when not critical', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			const rule = createApplyConditionRule(
				{ condition: 'dazed', trigger: 'onHit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));
			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor));
			expect(targetActor.toggleStatusEffect).toHaveBeenCalledWith('dazed', { active: true });
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

			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
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
			expect(ownerActor.toggleStatusEffect).not.toHaveBeenCalled();

			await rule.onTurnStart({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: ownerActor as unknown as Parameters<ApplyConditionRule['onTurnStart']>[0]['actor'],
			});
			expect(ownerActor.toggleStatusEffect).toHaveBeenCalledWith('focused', { active: true });
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

			expect(ownerActor.toggleStatusEffect).not.toHaveBeenCalled();
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
			expect(ownerActor.toggleStatusEffect).not.toHaveBeenCalled();

			await rule.onSaveResolved({
				actor: ownerActor as unknown as Parameters<
					ApplyConditionRule['onSaveResolved']
				>[0]['actor'],
				saveType: 'strength',
				outcome: 'fail',
			});
			expect(ownerActor.toggleStatusEffect).toHaveBeenCalledWith('prone', { active: true });
		});
	});

	describe('duration pass-through', () => {
		it('patches the ActiveEffect returned by toggleStatusEffect when duration is configured', async () => {
			const attackerActor = createMockActor();
			const effectUpdate = vi.fn().mockResolvedValue(undefined);
			const targetActor = createMockActorWithAppliedEffect(effectUpdate);

			const rule = createApplyConditionRule(
				{
					condition: 'smoldering',
					trigger: 'onCrit',
					duration: { rounds: 2 },
				},
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(effectUpdate).toHaveBeenCalledWith({ duration: { rounds: 2 } });
		});

		it('skips the update when no duration fields are set', async () => {
			const attackerActor = createMockActor();
			const effectUpdate = vi.fn().mockResolvedValue(undefined);
			const targetActor = createMockActorWithAppliedEffect(effectUpdate);

			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit' },
				attackerActor,
			);

			await rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true }));

			expect(effectUpdate).not.toHaveBeenCalled();
		});

		it('skips the update when toggleStatusEffect returns true (effect already existed)', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			targetActor.toggleStatusEffect.mockResolvedValue(true);

			const rule = createApplyConditionRule(
				{ condition: 'smoldering', trigger: 'onCrit', duration: { rounds: 2 } },
				attackerActor,
			);

			await expect(
				rule.onItemUsed(buildItemUsedContext(attackerActor, targetActor, { isCritical: true })),
			).resolves.not.toThrow();
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

			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
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

			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
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
			expect(targetActor.toggleStatusEffect).toHaveBeenCalled();
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
			expect(targetActor.toggleStatusEffect).not.toHaveBeenCalled();
		});
	});

	describe('nimble.conditionApplied hook', () => {
		it('fires Hooks.callAll after successfully applying a condition', async () => {
			const attackerActor = createMockActor();
			const effectUpdate = vi.fn().mockResolvedValue(undefined);
			const targetActor = createMockActorWithAppliedEffect(effectUpdate);
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
					effect: expect.objectContaining({ update: effectUpdate }),
				}),
			);
		});

		it('passes null effect when toggleStatusEffect returns true', async () => {
			const attackerActor = createMockActor();
			const targetActor = createMockActor();
			targetActor.toggleStatusEffect.mockResolvedValue(true);
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
