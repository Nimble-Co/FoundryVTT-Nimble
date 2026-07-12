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
	endAfterInactiveRounds?: number | null;
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
	Object.defineProperty(rule, 'endAfterInactiveRounds', {
		value: config.endAfterInactiveRounds ?? null,
		configurable: true,
		writable: true,
	});
	Object.defineProperty(rule, 'identifier', {
		value: config.identifier ?? '',
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
			expect(schema).toHaveProperty('turnOff');
			expect(schema).toHaveProperty('confirmEndPrompt');
			expect(schema).toHaveProperty('clearPoolsOnEnd');
			expect(schema).toHaveProperty('endAfterInactiveRounds');
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
			expect(choices).toContain('onActorDying');
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

		it('onActorDying deletes the AE when listed in turnOff', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorDying'] },
				actor,
			);
			pushAE(actor, rule.id, rule.item.id);

			type Ctx = Parameters<ToggleEffectRule['onActorDying']>[0];
			await rule.onActorDying({
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

		it('does NOT run the turn-off on clients that are not the active GM', async () => {
			gameGlobal.game.users = { activeGM: { id: 'a-different-gm', isSelf: false } };

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

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});

	describe('modifyToggle turn-off suppression', () => {
		function attachModifier(
			actor: MockActor,
			modifier: Record<string, unknown>,
		): Record<string, unknown> {
			actor.items = {
				contents: [{ rules: { values: () => [modifier] } }],
			};
			return modifier;
		}

		function pushAE(actor: MockActor, ruleId: string): MockActiveEffect {
			const ae = createMockActiveEffect(
				{ nimble: { toggleEffectRuleId: ruleId, toggleEffectItemId: 'item-id' } },
				{ id: 'ae-active', disabled: false },
			);
			actor.effects.push(ae);
			return ae;
		}

		function killContext(actor: MockActor) {
			type Ctx = Parameters<ToggleEffectRule['onActorKilled']>[0];
			return { actor: actor as unknown as Ctx['actor'], previousHp: 10, currentHp: 0 };
		}

		it('suppresses a turn-off event listed by a matching modifyToggle rule', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'], identifier: 'rage' },
				actor,
			);
			pushAE(actor, rule.id);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				suppressTurnOff: ['onActorKilled'],
			});

			await rule.onActorKilled(killContext(actor));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('matches by the toggle rule id when its identifier is empty', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'], id: 'rage-toggle' },
				actor,
			);
			pushAE(actor, 'rage-toggle');
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage-toggle',
				suppressTurnOff: ['onActorKilled'],
			});

			await rule.onActorKilled(killContext(actor));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('only suppresses the listed events, others still fire', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled', 'onRest'], identifier: 'rage' },
				actor,
			);
			pushAE(actor, rule.id);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				suppressTurnOff: ['onActorKilled'],
			});

			type Ctx = Parameters<ToggleEffectRule['onRest']>[0];
			await rule.onRest({ actor: actor as unknown as Ctx['actor'], restType: 'safe' });

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('ignores disabled modifyToggle rules', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'], identifier: 'rage' },
				actor,
			);
			pushAE(actor, rule.id);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				suppressTurnOff: ['onActorKilled'],
				disabled: true,
			});

			await rule.onActorKilled(killContext(actor));

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('ignores modifyToggle rules whose predicate fails (appliesTo false)', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'], identifier: 'rage' },
				actor,
			);
			pushAE(actor, rule.id);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'rage',
				suppressTurnOff: ['onActorKilled'],
				appliesTo: () => false,
			});

			await rule.onActorKilled(killContext(actor));

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('ignores modifyToggle rules targeting a different toggle', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: ['onActorKilled'], identifier: 'rage' },
				actor,
			);
			pushAE(actor, rule.id);
			attachModifier(actor, {
				type: 'modifyToggle',
				toggleIdentifier: 'some-other-toggle',
				suppressTurnOff: ['onActorKilled'],
			});

			await rule.onActorKilled(killContext(actor));

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});
	});

	describe('endAfterInactiveRounds: inactivity tracking', () => {
		const gameGlobal = globalThis as unknown as {
			game: { combat?: unknown; users?: unknown };
		};
		const globalScope = globalThis as unknown as {
			foundry: { applications: { api: { DialogV2: { confirm: Mock } } } };
			ChatMessage?: unknown;
		};
		let originalCombat: unknown;
		let originalUsers: unknown;
		let originalChatMessage: unknown;
		let chatCreate: Mock;

		function setCombat(combat: unknown) {
			gameGlobal.game.combat = combat;
		}

		function getDialogConfirm(): Mock {
			return globalScope.foundry.applications.api.DialogV2.confirm;
		}

		function pushAE(
			actor: MockActor,
			ruleId: string,
			activity: { round?: number; combatId?: string } = {},
		): MockActiveEffect {
			const nimbleFlags: Record<string, unknown> = {
				toggleEffectRuleId: ruleId,
				toggleEffectItemId: 'item-id',
			};
			if (typeof activity.round === 'number') {
				nimbleFlags.toggleEffectActivityRound = activity.round;
				nimbleFlags.toggleEffectActivityCombatId = activity.combatId ?? 'combat-1';
			}
			const ae = createMockActiveEffect(
				{ nimble: nimbleFlags },
				{ id: 'ae-active', disabled: false },
			);
			actor.effects.push(ae);
			return ae;
		}

		function turnEndContext(actor: MockActor, round: number, combatId = 'combat-1') {
			type Ctx = Parameters<ToggleEffectRule['onTurnEnd']>[0];
			return {
				combat: { id: combatId, round } as unknown as Ctx['combat'],
				combatant: {} as Ctx['combatant'],
				actor: actor as unknown as Ctx['actor'],
			};
		}

		beforeEach(() => {
			originalCombat = gameGlobal.game.combat;
			originalUsers = gameGlobal.game.users;
			originalChatMessage = globalScope.ChatMessage;
			gameGlobal.game.users = { activeGM: { isSelf: true } };
			getDialogConfirm().mockReset();
			getDialogConfirm().mockResolvedValue(true);
			chatCreate = vi.fn().mockResolvedValue(undefined);
			globalScope.ChatMessage = { create: chatCreate, getSpeaker: vi.fn(() => ({})) };
		});

		afterEach(() => {
			gameGlobal.game.combat = originalCombat;
			gameGlobal.game.users = originalUsers;
			globalScope.ChatMessage = originalChatMessage;
		});

		it('asks the GM and ends the toggle after a full round without activity', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			pushAE(actor, rule.id, { round: 1 });

			await rule.onTurnEnd(turnEndContext(actor, 2));

			expect(getDialogConfirm()).toHaveBeenCalledTimes(1);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
			expect(chatCreate).toHaveBeenCalledTimes(1);
		});

		it('keeps the toggle and resets the clock when the GM declines', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });
			getDialogConfirm().mockResolvedValue(false);

			await rule.onTurnEnd(turnEndContext(actor, 2));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(chatCreate).not.toHaveBeenCalled();
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(2);
		});

		it('resets the clock instead of ending when the recorded round is in the future (rewound combat)', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 3 });

			await rule.onTurnEnd(turnEndContext(actor, 1));

			expect(getDialogConfirm()).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);
		});

		it('prompts again on a replayed round after a decline followed by a rewind', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });

			// Round 2 turn end: prompt fires, GM declines, clock resets to 2.
			getDialogConfirm().mockResolvedValue(false);
			await rule.onTurnEnd(turnEndContext(actor, 2));
			expect(getDialogConfirm()).toHaveBeenCalledTimes(1);
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(2);

			// GM rewinds to round 1; the berserker's replayed turn end clamps
			// the future stamp back to the current round.
			await rule.onTurnEnd(turnEndContext(actor, 1));
			expect(getDialogConfirm()).toHaveBeenCalledTimes(1);
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);

			// Round 2 replays with no attack: the prompt returns.
			getDialogConfirm().mockResolvedValue(true);
			await rule.onTurnEnd(turnEndContext(actor, 2));
			expect(getDialogConfirm()).toHaveBeenCalledTimes(2);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('onRoundChanged clamps a future stamp the moment the round is rewound', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 2 });

			type Ctx = Parameters<ToggleEffectRule['onRoundChanged']>[0];
			await rule.onRoundChanged({
				combat: { id: 'combat-1' } as unknown as Ctx['combat'],
				actor: actor as unknown as Ctx['actor'],
				round: 1,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('onRoundChanged leaves a past stamp alone when the round advances', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });

			type Ctx = Parameters<ToggleEffectRule['onRoundChanged']>[0];
			await rule.onRoundChanged({
				combat: { id: 'combat-1' } as unknown as Ctx['combat'],
				actor: actor as unknown as Ctx['actor'],
				round: 2,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);
		});

		it('onRoundChanged ignores stamps belonging to a different combat', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 5, combatId: 'old-combat' });

			type Ctx = Parameters<ToggleEffectRule['onRoundChanged']>[0];
			await rule.onRoundChanged({
				combat: { id: 'combat-1' } as unknown as Ctx['combat'],
				actor: actor as unknown as Ctx['actor'],
				round: 1,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(5);
		});

		it('does nothing on clients other than the active GM', async () => {
			gameGlobal.game.users = { activeGM: { isSelf: false } };
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			pushAE(actor, rule.id, { round: 1 });

			await rule.onTurnEnd(turnEndContext(actor, 2));

			expect(getDialogConfirm()).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('does not end the toggle when activity happened this round', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			pushAE(actor, rule.id, { round: 2 });

			await rule.onTurnEnd(turnEndContext(actor, 2));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('stamps a grace baseline instead of ending when no activity was recorded', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id);

			await rule.onTurnEnd(turnEndContext(actor, 3));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(3);
			expect(ae.flags.nimble.toggleEffectActivityCombatId).toBe('combat-1');
		});

		it('re-stamps instead of ending when the recorded combat differs', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1, combatId: 'old-combat' });

			await rule.onTurnEnd(turnEndContext(actor, 5, 'combat-2'));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
			expect(ae.flags.nimble.toggleEffectActivityCombatId).toBe('combat-2');
			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(5);
		});

		it('does nothing at turn end when endAfterInactiveRounds is unset', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: [] }, actor);
			pushAE(actor, rule.id, { round: 1 });

			await rule.onTurnEnd(turnEndContext(actor, 5));

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('records activity when the owning item is re-activated while the toggle is on', async () => {
			setCombat({ id: 'combat-1', round: 4, started: true });
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });

			type Ctx = Parameters<ToggleEffectRule['onItemActivated']>[0];
			await rule.onItemActivated({
				sourceItem: rule.item as unknown as Ctx['sourceItem'],
				sourceActor: actor as unknown as Ctx['sourceActor'],
				card: null,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(4);
		});

		it('records activity when another item with a damage effect is activated (attack)', async () => {
			setCombat({ id: 'combat-1', round: 4, started: true });
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });
			const weapon = {
				...createMockItem(actor, { id: 'weapon-id' }),
				system: { activation: { effects: [{ type: 'damage' }] } },
			};

			type Ctx = Parameters<ToggleEffectRule['onItemActivated']>[0];
			await rule.onItemActivated({
				sourceItem: weapon as unknown as Ctx['sourceItem'],
				sourceActor: actor as unknown as Ctx['sourceActor'],
				card: null,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(4);
		});

		it('does not record activity for non-attack activations of other items', async () => {
			setCombat({ id: 'combat-1', round: 4, started: true });
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });
			const potion = {
				...createMockItem(actor, { id: 'potion-id' }),
				system: { activation: { effects: [{ type: 'healing' }] } },
			};

			type Ctx = Parameters<ToggleEffectRule['onItemActivated']>[0];
			await rule.onItemActivated({
				sourceItem: potion as unknown as Ctx['sourceItem'],
				sourceActor: actor as unknown as Ctx['sourceActor'],
				card: null,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);
		});

		it('does not record activity outside an active combat', async () => {
			setCombat(undefined);
			const actor = createMockActor();
			const rule = createToggleEffectRule(
				{ tags: ['self:raging'], turnOff: [], endAfterInactiveRounds: 1 },
				actor,
			);
			const ae = pushAE(actor, rule.id, { round: 1 });
			const weapon = {
				...createMockItem(actor, { id: 'weapon-id' }),
				system: { activation: { effects: [{ type: 'damage' }] } },
			};

			type Ctx = Parameters<ToggleEffectRule['onItemActivated']>[0];
			await rule.onItemActivated({
				sourceItem: weapon as unknown as Ctx['sourceItem'],
				sourceActor: actor as unknown as Ctx['sourceActor'],
				card: null,
			});

			expect(ae.flags.nimble.toggleEffectActivityRound).toBe(1);
		});
	});

	describe('afterDelete: AE cleanup on item deletion', () => {
		it('deletes the backing AE when the owning item is deleted', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{ nimble: { toggleEffectRuleId: rule.id, toggleEffectItemId: rule.item.id } },
					{ id: 'ae-orphan', disabled: false },
				),
			);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-orphan']);
		});

		it('is a no-op when no backing AE exists', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('ignores AEs belonging to a different toggle rule', async () => {
			const actor = createMockActor();
			const rule = createToggleEffectRule({ tags: ['self:raging'], turnOff: ['onRest'] }, actor);
			actor.effects.push(
				createMockActiveEffect(
					{
						nimble: { toggleEffectRuleId: 'some-other-rule-id', toggleEffectItemId: rule.item.id },
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

			await rule.afterDelete();

			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
