import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('Hooks', { call: vi.fn().mockReturnValue(true), callAll: vi.fn() });

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	setPoolFaces: vi.fn().mockResolvedValue(true),
}));

import { ToggleEffectRule, type TurnOffEvent } from './toggleEffect.js';

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
	getDomain: Mock<() => Set<string>>;
}

interface ToggleEffectSource {
	tags: string[];
	turnOff: TurnOffEvent[];
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
	turnOff: TurnOffEvent[];
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
			if ('disabled' in data) effect.disabled = data.disabled as boolean;
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
		turnOff: config.turnOff,
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
	rule.turnOff = config.turnOff;
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

	Object.defineProperty(rule, 'item', { get: () => parentItem, configurable: true });
	Object.defineProperty(rule, '_predicate', {
		get: () => ({ size: 0, test: () => true }),
		configurable: true,
	});

	return rule;
}

describe('ToggleEffectRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ToggleEffectRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('tags');
			expect(schema).toHaveProperty('turnOff');
			expect(schema).toHaveProperty('confirmEndPrompt');
			expect(schema).toHaveProperty('clearPoolsOnEnd');
		});

		it('declares the supported turnOff trigger choices', () => {
			const schema = ToggleEffectRule.defineSchema();
			const turnOffField = schema.turnOff as unknown as {
				element: { choices: readonly string[] };
			};
			const choices = turnOffField.element.choices;
			expect(choices).toContain('onActorKilled');
			expect(choices).toContain('onActorWounded');
			expect(choices).toContain('onRest');
			expect(choices).toContain('onTurnStart');
			expect(choices).toContain('onTurnEnd');
			expect(choices).toContain('onEncounterEnd');
			expect(choices).toContain('onUnconscious');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ToggleEffectRule.group).toBe('triggers');
			expect(ToggleEffectRule.description).toBe('NIMBLE.rules.toggleEffect.description');
		});
	});

	describe('prePrepareData: tag push', () => {
		it('pushes all configured tags into actor.tags when an enabled AE exists', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging', 'self:berserk'], turnOff: ['onRest'] },
				actor,
			);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(true);
			expect(actor.tags.has('self:berserk')).toBe(true);
		});

		it('does not push tags when no matching AE exists', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the AE exists but is disabled', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
					{ id: 'ae-1', disabled: true },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the rule itself is disabled', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onRest'], disabled: true },
				actor,
			);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('does not push tags when the item is not embedded', () => {
			const actor = createMockActor();
			const item = createMockItem(actor, { isEmbedded: false });
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onRest'] },
				actor,
				item,
			);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
					{ id: 'ae-1', disabled: false },
				),
			);

			rule.prePrepareData();

			expect(actor.tags.has('self:raging')).toBe(false);
		});

		it('ignores AEs flagged for a different rule id', () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{
						nimble: { toggleEffectRuleId: 'some-other-rule-id', toggleEffectItemId: rule.item.id },
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

		it('creates an AE on the actor on first activation, flagged to this rule', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onRest'], label: 'Rage' },
				actor,
			);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			const [type, data] = actor.createEmbeddedDocuments.mock.calls[0] ?? [];
			expect(type).toBe('ActiveEffect');
			expect(Array.isArray(data)).toBe(true);
			const created = (data as Array<Record<string, unknown>>)[0];
			expect(created).toMatchObject({
				disabled: false,
				flags: {
					nimble: {
						toggleEffectRuleId: rule.id,
						toggleEffectItemId: rule.item.id,
					},
				},
			});
		});

		it('stamps the AE with origin: <item uuid> so the effects panel links back to the item', async () => {
			const actor = createMockActor();
			const item = createMockItem(actor, { uuid: 'Actor.abc.Item.rage-1' });
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onRest'] },
				actor,
				item,
			);

			await rule.onItemActivated(buildContext(item, actor));

			const [, data] = actor.createEmbeddedDocuments.mock.calls[0] ?? [];
			const created = (data as Array<Record<string, unknown>>)[0];
			expect(created?.origin).toBe('Actor.abc.Item.rage-1');
		});

		it('is a no-op when the AE is already enabled (re-use does not turn off (avoids misclick footgun))', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			const existing = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
				{ id: 'ae-existing', disabled: false },
			);
			actor.effects.push(existing);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(existing.update).not.toHaveBeenCalled();
		});

		it('re-enables a disabled AE instead of deleting it (player toggled off via effects panel)', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			const disabledEffect = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
				{ id: 'ae-disabled', disabled: true },
			);
			actor.effects.push(disabledEffect);

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(disabledEffect.update).toHaveBeenCalledWith({ disabled: false });
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('does nothing when sourceItem is not this rule’s item', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			const otherItem = createMockItem(actor, { id: 'other-item-id' });

			await rule.onItemActivated(buildContext(otherItem, actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('does nothing when the rule predicate fails', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			Object.defineProperty(rule, '_predicate', {
				get: () => ({ size: 1, test: () => false }),
				configurable: true,
			});

			await rule.onItemActivated(buildContext(rule.item as unknown as MockItem, actor));

			expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	describe('turnOff dispatch: per-event AE deletion', () => {
		function pushAE(actor: MockActor, ruleId: string, itemId: string | null): MockActiveEffect {
			const ae = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: ruleId, toggleEffectItemId: itemId } },
				{ id: 'ae-active', disabled: false },
			);
			actor.effects.push(ae);
			return ae;
		}

		it('onActorKilled deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onActorKilled']>[0];
			await rule.onActorKilled({
				actor: actor as unknown as Ctx['actor'],
				previousHp: 10,
				currentHp: 0,
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onActorKilled does NOT delete the AE when not listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onActorKilled']>[0];
			await rule.onActorKilled({
				actor: actor as unknown as Ctx['actor'],
				previousHp: 10,
				currentHp: 0,
			});

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('onRest deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onRest']>[0];
			await rule.onRest({
				actor: actor as unknown as Ctx['actor'],
				restType: 'safe',
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onTurnStart deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onTurnStart'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onTurnStart']>[0];
			await rule.onTurnStart({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: actor as unknown as Ctx['actor'],
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onTurnEnd deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onTurnEnd'] }, actor);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onTurnEnd']>[0];
			await rule.onTurnEnd({
				combat: {} as Combat,
				combatant: {} as Combatant,
				actor: actor as unknown as Ctx['actor'],
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onActorWounded deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorWounded'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onActorWounded']>[0];
			await rule.onActorWounded({
				actor: actor as unknown as Ctx['actor'],
				previousHp: 20,
				currentHp: 5,
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onEncounterEnd deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onEncounterEnd'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onEncounterEnd']>[0];
			await rule.onEncounterEnd({
				combat: {} as Combat,
				actor: actor as unknown as Ctx['actor'],
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onUnconscious deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onUnconscious'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onUnconscious']>[0];
			await rule.onUnconscious({
				actor: actor as unknown as Ctx['actor'],
				source: null,
			});

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('does NOT fire when the turnOff event targets a different actor', async () => {
			const ownerActor = createMockActor();
			const otherActor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onRest'] },
				ownerActor,
			);
			pushAE(ownerActor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onRest']>[0];
			await rule.onRest({
				actor: otherActor as unknown as Ctx['actor'],
				restType: 'safe',
			});

			expect(ownerActor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('is a no-op when no AE exists on the actor', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);

			type Ctx = Parameters<ToggleEffectRule['onRest']>[0];
			await rule.onRest({
				actor: actor as unknown as Ctx['actor'],
				restType: 'safe',
			});

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
