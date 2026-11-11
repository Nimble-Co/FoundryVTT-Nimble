import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('Hooks', { call: vi.fn().mockReturnValue(true), callAll: vi.fn() });
vi.stubGlobal('ChatMessage', {
	create: vi.fn().mockResolvedValue(undefined),
	getSpeaker: vi.fn(() => ({})),
});

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	setPoolFaces: vi.fn().mockResolvedValue(true),
}));

import { AUTOMATION_SETTING_KEYS } from '../../../settings/automationSettings.js';
import { NIMBLE_EFFECT_TYPE } from '../../activeEffect/nimbleEffectChoices.js';
import { ToggleEffectRule } from '../toggleEffect.js';

interface MockActiveEffect {
	id: string;
	name: string;
	img: string;
	disabled: boolean;
	flags: Record<string, Record<string, unknown>>;
	getFlag: Mock<(scope: string, key: string) => unknown>;
	update: Mock<(data: Record<string, unknown>) => Promise<unknown>>;
}

interface MockActor {
	effects: MockActiveEffect[];
	tags: Set<string>;
	items?: { contents: Array<{ rules?: { values: () => Iterable<unknown> } }> };
	createEmbeddedDocuments: Mock<
		(type: string, data: Array<Record<string, unknown>>) => Promise<MockActiveEffect[]>
	>;
	deleteEmbeddedDocuments: Mock<(type: string, ids: string[]) => Promise<void>>;
	getDomain: Mock<() => Set<string>>;
}

interface MockItem {
	actor: MockActor;
	isEmbedded: boolean;
	name: string;
	img: string;
	id: string;
	uuid: string;
	system?: { activation?: { effects?: Array<{ type?: string }> } };
	getDomain: Mock<() => Set<string>>;
}

interface ToggleEffectSource {
	tags: string[];
	effectId?: string;
	disabled?: boolean;
	label?: string;
	id?: string;
	identifier?: string;
	priority?: number;
	predicate?: Record<string, unknown>;
	type?: string;
	confirmEndPrompt?: string;
	clearPoolsOnEnd?: string[];
}

interface ToggleEffectRuleTestInstance extends ToggleEffectRule {
	tags: string[];
	disabled: boolean;
	label: string;
}

function createMockActiveEffect(
	flags: Record<string, Record<string, unknown>>,
	overrides: Partial<MockActiveEffect> = {},
): MockActiveEffect {
	const effect: MockActiveEffect = {
		id: overrides.id ?? 'effect-id',
		name: overrides.name ?? 'Test Effect',
		img: overrides.img ?? 'icons/svg/aura.svg',
		disabled: overrides.disabled ?? false,
		flags,
		getFlag: vi.fn((scope: string, key: string) => flags[scope]?.[key]),
		update: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
			for (const [key, value] of Object.entries(data)) {
				if (key === 'disabled') {
					effect.disabled = value as boolean;
					continue;
				}
				const flagPath = key.match(/^flags\.([^.]+)\.(.+)$/);
				if (flagPath) {
					effect.flags[flagPath[1]] = {
						...(effect.flags[flagPath[1]] ?? {}),
						[flagPath[2]]: value,
					};
				}
			}
			return undefined;
		}),
	};
	return effect;
}

function createMockActor(effects: MockActiveEffect[] = []): MockActor {
	return {
		effects,
		tags: new Set<string>(),
		createEmbeddedDocuments: vi
			.fn()
			.mockImplementation(async (_type: string, data: Array<Record<string, unknown>>) => {
				const created: MockActiveEffect[] = data.map((d, i) => {
					const effectFlags = (d.flags as Record<string, Record<string, unknown>>) ?? {};
					return createMockActiveEffect(effectFlags, {
						id: `created-effect-${i}`,
						name: d.name as string,
						img: d.img as string,
						disabled: (d.disabled as boolean) ?? false,
					});
				});
				effects.push(...created);
				return created;
			}),
		deleteEmbeddedDocuments: vi.fn().mockImplementation(async (_type: string, ids: string[]) => {
			for (const id of ids) {
				const idx = effects.findIndex((e) => e.id === id);
				if (idx >= 0) effects.splice(idx, 1);
			}
		}),
		getDomain: vi.fn(() => new Set<string>()),
	};
}

function createMockItem(actor: MockActor, overrides: Partial<MockItem> = {}): MockItem {
	return {
		actor,
		isEmbedded: overrides.isEmbedded ?? true,
		name: overrides.name ?? 'Rage',
		img: overrides.img ?? 'icons/skills/berserker.png',
		id: overrides.id ?? 'item-id',
		uuid: overrides.uuid ?? 'test-item-uuid',
		getDomain: vi.fn(() => new Set<string>()),
	};
}

function createToggleEffectRule(
	config: ToggleEffectSource,
	actor: MockActor,
	item?: MockItem,
): ToggleEffectRuleTestInstance {
	const parentItem = item ?? createMockItem(actor);
	const sourceData = {
		tags: config.tags,
		effectId: config.effectId ?? '',
		disabled: config.disabled ?? false,
		label: config.label ?? '',
		id: config.id ?? 'rule-id',
		identifier: config.identifier ?? '',
		priority: config.priority ?? 1,
		predicate: config.predicate ?? {},
		type: 'toggleEffect',
		confirmEndPrompt: config.confirmEndPrompt ?? '',
		clearPoolsOnEnd: config.clearPoolsOnEnd ?? [],
	};

	const rule = new ToggleEffectRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<ToggleEffectRule['schema']['fields']>,
		{ parent: parentItem as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as ToggleEffectRuleTestInstance;

	rule.tags = config.tags;
	rule.disabled = config.disabled ?? false;
	rule.label = config.label ?? '';
	Object.defineProperty(rule, 'clearPoolsOnEnd', {
		value: config.clearPoolsOnEnd ?? [],
		configurable: true,
		writable: true,
	});
	Object.defineProperty(rule, 'confirmEndPrompt', {
		value: config.confirmEndPrompt ?? '',
		configurable: true,
		writable: true,
	});
	Object.defineProperty(rule, 'effectId', {
		value: config.effectId ?? '',
		configurable: true,
		writable: true,
	});
	Object.defineProperty(rule, 'identifier', {
		value: config.identifier ?? '',
		configurable: true,
		writable: true,
	});

	Object.defineProperty(rule, 'parent', { get: () => parentItem, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});

	return rule;
}

describe('ToggleEffectRule', () => {
	const gameGlobal = globalThis as unknown as { game: { user?: unknown; users?: unknown } };
	let savedUsers: unknown;

	beforeEach(() => {
		vi.clearAllMocks();
		// Designate this client as the active GM so the isActiveGM-gated turn-off
		// path runs ('test-user-id' is the shared game.user mock).
		savedUsers = gameGlobal.game.users;
		gameGlobal.game.users = { activeGM: { id: 'test-user-id', isSelf: true } };
	});

	afterEach(() => {
		gameGlobal.game.users = savedUsers;
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ToggleEffectRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('tags');
			expect(schema).toHaveProperty('effectId');
			expect(schema).not.toHaveProperty('turnOff');
			expect(schema).not.toHaveProperty('endAfterInactiveRounds');
			expect(schema).toHaveProperty('confirmEndPrompt');
			expect(schema).toHaveProperty('clearPoolsOnEnd');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ToggleEffectRule.group).toBe('triggers');
			expect(ToggleEffectRule.description).toBe('NIMBLE.rules.toggleEffect.description');
		});

		it('declares onItemActivated as always dispatched', () => {
			// This declaration is the only thing keeping the activation-time
			// toggle-on flow alive when rule automation is toggled off; the
			// dispatcher gate tests only exercise synthetic rule classes, so
			// pin the real declaration here.
			expect(ToggleEffectRule.alwaysDispatchedEvents).toContain('onItemActivated');
		});
	});

	describe('prePrepareData: tag push', () => {
		it('pushes all configured tags into actor.tags when an enabled AE exists', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging', 'self:berserk'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(true);
			expect(actor.tags.has('self:berserk')).toBe(true);
		});

		it('does not push tags when no matching AE exists', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the AE exists but is disabled', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-1', disabled: true },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the rule itself is disabled', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], disabled: true }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the item is not embedded', () => {
			const actor = createMockActor();
			const item = createMockItem(actor, { isEmbedded: false });
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor, item);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('ignores AEs flagged for a different rule id', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{
						nimble: {
							toggleEffectRuleId: 'some-other-rule-id',
							toggleEffectItemId: rule.parentDocument.id,
						},
					},
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});
	});

	describe('onItemActivated: toggle on/off', () => {
		function buildContext(item: MockItem, actor: MockActor) {
			type Ctx = Parameters<ToggleEffectRule['onItemActivated']>[0];
			return {
				sourceItem: item as unknown as Ctx['sourceItem'],
				sourceActor: actor as unknown as Ctx['sourceActor'],
				card: null,
			};
		}

		it('creates a Nimble AE on the actor on first activation, flagged to this rule', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], label: 'Rage' }, actor);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			const [type, data] = actor.createEmbeddedDocuments.mock.calls[0] ?? [];
			expect(type).toBe('ActiveEffect');
			expect(Array.isArray(data)).toBe(true);
			const created = (data as Array<Record<string, unknown>>)[0];
			expect(created).toMatchObject({
				type: NIMBLE_EFFECT_TYPE,
				disabled: false,
				flags: {
					nimble: {
						toggleEffectRuleId: rule.id,
						toggleEffectItemId: rule.parentDocument.id,
					},
				},
			});
		});

		it('stamps the AE with origin: <item uuid> so the effects panel links back to the item', async () => {
			const actor = createMockActor();
			const item = createMockItem(actor, { uuid: 'Actor.abc.Item.rage-1' });
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor, item);

			await rule.onItemActivated(buildContext(item, actor));

			const [, data] = actor.createEmbeddedDocuments.mock.calls[0] ?? [];
			const created = (data as Array<Record<string, unknown>>)[0];
			expect(created?.origin).toBe('Actor.abc.Item.rage-1');
		});

		it('is a no-op when the AE is already enabled (re-use does not turn off (avoids misclick footgun))', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			const existing = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
				{ id: 'ae-existing', disabled: false },
			);
			actor.effects.push(existing);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(existing.update).not.toHaveBeenCalled();
		});

		it('replaces a disabled AE with a new copy, so it starts again', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			const disabledEffect = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
				{ id: 'ae-disabled', disabled: true },
			);
			actor.effects.push(disabledEffect);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(disabledEffect.update).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-disabled'], {
				nimbleConditionReplaced: true,
			});
			expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			expect(actor.effects.map((effect) => effect.disabled)).toEqual([false]);
		});

		it('does nothing when sourceItem is not this rule’s item', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			const otherItem = createMockItem(actor, { id: 'other-item-id' });

			await rule.onItemActivated(buildContext(otherItem, actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('does nothing when the rule predicate fails', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			Object.defineProperty(rule, 'predicate', {
				get: () => ({ size: 1, test: () => false }),
				configurable: true,
			});

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	describe('modifyToggle auto turn-on', () => {
		function attachModifier(
			actor: MockActor,
			modifier: Record<string, unknown>,
		): Record<string, unknown> {
			actor.items = {
				contents: [{ rules: { values: () => [modifier] } }],
			};
			return modifier;
		}

		function turnContext(actor: MockActor) {
			type Ctx = Parameters<ToggleEffectRule['onTurnStart']>[0];
			return {
				actor: actor as unknown as Ctx['actor'],
				combat: {} as Ctx['combat'],
				combatant: {} as Ctx['combatant'],
			};
		}

		function attackContext(actor: MockActor, isCritical: boolean) {
			type Ctx = Parameters<ToggleEffectRule['onAttackReceived']>[0];
			return {
				sourceItem: {} as Ctx['sourceItem'],
				sourceActor: {} as Ctx['sourceActor'],
				targetActor: actor as unknown as Ctx['targetActor'],
				card: null,
				isCritical,
				isMiss: false,
			};
		}

		it('creates the backing AE at turn start when a matching rule requests it', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onTurnStart'],
			});

			await rule.onTurnStart(turnContext(actor));

			expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
		});

		it('replaces a disabled backing AE with one new copy', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			const ae = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: 'item-id' } },
				{ id: 'ae-off', disabled: true },
			);
			actor.effects.push(ae);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onTurnStart'],
			});

			await rule.onTurnStart(turnContext(actor));

			expect(ae.update).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-off'], {
				nimbleConditionReplaced: true,
			});
			expect(actor.effects).toHaveLength(1);
			expect(actor.effects[0]?.id).not.toBe('ae-off');
		});

		it('is a no-op when the toggle is already on', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			const ae = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: 'item-id' } },
				{ id: 'ae-on', disabled: false },
			);
			actor.effects.push(ae);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onTurnStart'],
			});

			await rule.onTurnStart(turnContext(actor));

			expect(ae.update).not.toHaveBeenCalled();
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('respects the requesting rule predicate via appliesTo', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onTurnStart'],
				appliesTo: () => false,
			});

			await rule.onTurnStart(turnContext(actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('turns on from a received critical hit but not a normal hit', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onCritReceived'],
			});

			await rule.onAttackReceived(attackContext(actor, false));
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();

			await rule.onAttackReceived(attackContext(actor, true));
			expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
		});

		it('turns on from a crit that a reroll discarded when the reroll keeps its crit triggers', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onCritReceived'],
			});

			await rule.onAttackReceived({ ...attackContext(actor, false), discardedCritTriggers: true });

			expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
		});

		it('does nothing when this client is not the active GM', async () => {
			const gameGlobal = globalThis as unknown as {
				game: { users?: { activeGM?: { id: string; isSelf: boolean } } };
			};
			gameGlobal.game.users = { activeGM: { id: 'a-different-gm', isSelf: false } };

			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], identifier: 'rage' }, actor);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				turnOn: ['onTurnStart'],
			});

			await rule.onTurnStart(turnContext(actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	describe('chat notification announcements', () => {
		const settingsGlobal = globalThis as unknown as {
			game: { settings?: { get: ReturnType<typeof vi.fn> } };
		};

		function getChatCreate(): Mock {
			return (globalThis as unknown as { ChatMessage: { create: Mock } }).ChatMessage.create;
		}

		function attachTurnOnModifier(actor: MockActor): void {
			actor.items = {
				contents: [
					{
						rules: {
							values: () => [
								{
									type: 'modifyToggle',
									toggleIdentifier: 'test-toggle',
									turnOn: ['onTurnStart'],
								},
							],
						},
					},
				],
			};
		}

		function turnStartContext(actor: MockActor) {
			type Ctx = Parameters<ToggleEffectRule['onTurnStart']>[0];
			return {
				combat: {} as Ctx['combat'],
				combatant: {} as Ctx['combatant'],
				actor: actor as unknown as Ctx['actor'],
			};
		}

		it('announces an automatic turn-on in chat by default (fail-open, no stored setting)', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:test'], identifier: 'test-toggle' },
				actor,
			);
			attachTurnOnModifier(actor);

			await rule.onTurnStart(turnStartContext(actor));

			expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
			expect(getChatCreate()).toHaveBeenCalledTimes(1);
		});

		describe('with the chat notifications automation toggle off', () => {
			// The rest of this file exercises the enabled path via the
			// fail-open default (no game.settings mock); this block installs
			// an explicit settings mock that disables only the chat
			// notifications key and removes it afterwards so other tests stay
			// on the fail-open path.
			beforeEach(() => {
				settingsGlobal.game.settings = {
					get: vi.fn(
						(_namespace: string, key: string) => key !== AUTOMATION_SETTING_KEYS.chatNotifications,
					),
				};
			});

			afterEach(() => {
				settingsGlobal.game.settings = undefined;
			});

			it('still turns the toggle on but posts no start announcement', async () => {
				const actor = createMockActor();
				const rule = createToggleEffectRule(
					{ tags: ['self:test'], identifier: 'test-toggle' },
					actor,
				);
				attachTurnOnModifier(actor);

				await rule.onTurnStart(turnStartContext(actor));

				expect(actor.createEmbeddedDocuments).toHaveBeenCalled();
				expect(getChatCreate()).not.toHaveBeenCalled();
			});
		});
	});

	describe('afterDelete: AE cleanup on item deletion', () => {
		it('deletes the backing AE when the owning item is deleted', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-orphan', disabled: false },
				),
			);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-orphan']);
		});

		it('is a no-op when no backing AE exists', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('ignores AEs belonging to a different toggle rule', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{
						nimble: {
							toggleEffectRuleId: 'some-other-rule-id',
							toggleEffectItemId: rule.parentDocument.id,
						},
					},
					{ id: 'ae-other', disabled: false },
				),
			);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('is a no-op when the item is not embedded', async () => {
			const actor = createMockActor();
			const item = createMockItem(actor, { isEmbedded: false });
			const rule = createToggleEffectRule({ tags: ['self:raging'] }, actor, item);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.parentDocument.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
