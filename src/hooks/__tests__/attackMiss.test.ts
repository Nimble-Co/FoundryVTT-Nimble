import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync } from '../../../tests/helpers.js';

const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

vi.stubGlobal('Hooks', {
	on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
		handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		return 1;
	}),
	once: vi.fn(),
	off: vi.fn(),
	call: vi.fn(),
	callAll: vi.fn((event: string, ...args: unknown[]) => {
		for (const handler of handlers.get(event) ?? []) handler(...args);
		return true;
	}),
});

const activeGm = { id: 'gm' };
const settingsGet = vi.fn(() => true);
const actorsGet = vi.fn(() => null);
vi.stubGlobal('game', {
	settings: { get: settingsGet },
	user: { id: 'gm', isGM: true },
	users: { activeGM: activeGm },
	actors: { get: actorsGet },
});

const tokens = new Map<string, { actor: unknown }>();
vi.stubGlobal(
	'fromUuidSync',
	vi.fn((uuid: string) => tokens.get(uuid) ?? null),
);

import { SYSTEM_ID, systemHookName } from '#system';
import { registerAttackMissHooks } from '../attackMiss.js';
import registerRuleEventDispatch from '../ruleEventDispatch.js';

const DAMAGE = { type: 'damage', roll: { class: 'DamageRoll', total: 4 } };

interface RuleDouble {
	onItemUsed: Mock;
	onAttackReceived: Mock;
}

interface TestCard {
	id: string;
	type: string;
	system: Record<string, unknown>;
	speaker: { actor: string | null };
	flags: Record<string, Record<string, unknown>>;
	setFlag: Mock;
	cardDamageBack: { afterMiss: Mock };
}

function createCard(
	overrides: {
		id?: string;
		type?: string;
		system?: Record<string, unknown>;
		flags?: Record<string, Record<string, unknown>>;
	} = {},
): TestCard {
	const card = {
		id: overrides.id ?? 'card',
		type: overrides.type ?? 'feature',
		system: {
			isMiss: true,
			isCritical: false,
			targets: ['Scene.s.Token.target'],
			activation: {
				acquireTargetsFromTemplate: false,
				template: { shape: '' },
				effects: [DAMAGE],
			},
			...overrides.system,
		},
		speaker: { actor: 'attacker' },
		flags: overrides.flags ?? { [SYSTEM_ID]: { itemId: 'stab' } },
		setFlag: vi.fn(async (scope: string, key: string, value: unknown) => {
			const scopeFlags = card.flags[scope];
			if (scopeFlags?.[key] !== true) {
				throw new Error('attackMissed flag was not written before setFlag');
			}
			scopeFlags[key] = value;
			for (const handler of handlers.get('updateChatMessage') ?? []) handler(card);
		}),
		cardDamageBack: {
			afterMiss: vi.fn(async () => {
				for (const handler of handlers.get('updateChatMessage') ?? []) handler(card);
			}),
		},
	};
	return card;
}

function emit(event: string, card: TestCard): void {
	for (const handler of handlers.get(event) ?? []) handler(card);
}

function ruleDouble(): RuleDouble {
	return {
		onItemUsed: vi.fn().mockResolvedValue(undefined),
		onAttackReceived: vi.fn().mockResolvedValue(undefined),
	};
}

function placeActors() {
	const targetRule = ruleDouble();
	const targetActor = { type: 'character', rules: [targetRule] };
	tokens.set('Scene.s.Token.target', { actor: targetActor });

	const sourceRule = ruleDouble();
	const sourceItem = { id: 'stab' };
	const sourceActor = {
		id: 'attacker',
		rules: [sourceRule],
		items: { get: (id: string) => (id === 'stab' ? sourceItem : null) },
	};
	actorsGet.mockImplementation(((id: string) => (id === 'attacker' ? sourceActor : null)) as never);
	return { targetActor, targetRule, sourceActor, sourceRule };
}

describe('an attack that misses', () => {
	beforeAll(() => {
		registerRuleEventDispatch();
		registerAttackMissHooks();
	});

	beforeEach(() => {
		vi.clearAllMocks();
		settingsGet.mockReturnValue(true);
		actorsGet.mockReset();
		actorsGet.mockReturnValue(null);
		tokens.clear();
		activeGm.id = 'gm';
	});

	it('reports the miss once, with no Apply Damage click', async () => {
		const { targetActor, targetRule, sourceRule } = placeActors();
		const card = createCard();

		emit('createChatMessage', card);
		await flushAsync();

		expect(card.cardDamageBack.afterMiss).toHaveBeenCalledTimes(1);
		expect(card.cardDamageBack.afterMiss).toHaveBeenCalledWith([
			expect.objectContaining({ actor: targetActor }),
		]);
		expect(Hooks.callAll).toHaveBeenCalledTimes(1);
		expect(Hooks.callAll).toHaveBeenCalledWith(
			systemHookName('attackMissed'),
			expect.objectContaining({
				targetActor,
				isMiss: true,
				isCritical: false,
			}),
		);
		expect(Hooks.callAll).not.toHaveBeenCalledWith(
			systemHookName('damageApplied'),
			expect.anything(),
		);
		expect(sourceRule.onItemUsed).toHaveBeenCalledWith(
			expect.objectContaining({ isMiss: true, isCritical: false, targetActor }),
		);
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
		expect(targetRule.onAttackReceived).toHaveBeenCalledWith(
			expect.objectContaining({ isMiss: true, discardedCritTriggers: false }),
		);
		expect(card.flags[SYSTEM_ID]?.attackMissed).toBe(true);

		emit('updateChatMessage', card);
		await flushAsync();
		expect(card.cardDamageBack.afterMiss).toHaveBeenCalledTimes(1);
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
	});

	it('reports a miss when a reroll turns a hit into a miss, and not again', async () => {
		const { targetRule } = placeActors();
		const card = createCard({ system: { isMiss: false } });

		emit('createChatMessage', card);
		await flushAsync();
		expect(targetRule.onAttackReceived).not.toHaveBeenCalled();

		card.system.isMiss = true;
		emit('updateChatMessage', card);
		await flushAsync();
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);

		emit('updateChatMessage', card);
		await flushAsync();
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
	});

	it('reports one event for two damage packets', async () => {
		const { targetRule } = placeActors();
		const card = createCard({
			system: {
				activation: {
					acquireTargetsFromTemplate: false,
					template: { shape: '' },
					effects: [DAMAGE, { type: 'damage', roll: { class: 'DamageRoll', total: 2 } }],
				},
			},
		});

		emit('createChatMessage', card);
		await flushAsync();

		expect(Hooks.callAll).toHaveBeenCalledTimes(1);
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
	});

	it('reports only the first target', async () => {
		const { targetActor, targetRule } = placeActors();
		const otherRule = ruleDouble();
		tokens.set('Scene.s.Token.other', { actor: { rules: [otherRule] } });
		const card = createCard({
			system: { targets: ['Scene.s.Token.target', 'Scene.s.Token.other'] },
		});

		emit('createChatMessage', card);
		await flushAsync();

		expect(card.cardDamageBack.afterMiss).toHaveBeenCalledWith([
			expect.objectContaining({ actor: targetActor }),
		]);
		expect(targetRule.onAttackReceived).toHaveBeenCalledTimes(1);
		expect(otherRule.onAttackReceived).not.toHaveBeenCalled();
	});

	it('leaves a hit on the damage-applied path', async () => {
		const { targetActor, targetRule, sourceActor, sourceRule } = placeActors();
		const card = createCard({ system: { isMiss: false, isCritical: false } });

		emit('createChatMessage', card);
		await flushAsync();
		expect(card.cardDamageBack.afterMiss).not.toHaveBeenCalled();
		expect(Hooks.callAll).not.toHaveBeenCalled();

		for (const handler of handlers.get(systemHookName('damageApplied')) ?? []) {
			handler({
				sourceItem: { id: 'stab' },
				sourceActor,
				targetActor,
				card,
				isCritical: false,
				isMiss: false,
			});
		}
		await flushAsync();

		expect(targetRule.onAttackReceived).toHaveBeenCalledWith(
			expect.objectContaining({ isMiss: false, isCritical: false }),
		);
		expect(sourceRule.onItemUsed).toHaveBeenCalledWith(
			expect.objectContaining({ isMiss: false, isCritical: false }),
		);
	});

	it('leaves a crit on the damage-applied path', async () => {
		const { targetActor, targetRule } = placeActors();
		const card = createCard({ system: { isMiss: false, isCritical: true } });

		emit('createChatMessage', card);
		await flushAsync();
		expect(Hooks.callAll).not.toHaveBeenCalled();

		for (const handler of handlers.get(systemHookName('damageApplied')) ?? []) {
			handler({
				sourceItem: { id: 'stab' },
				sourceActor: { rules: [] },
				targetActor,
				card,
				isCritical: true,
				isMiss: false,
			});
		}
		await flushAsync();

		expect(targetRule.onAttackReceived).toHaveBeenCalledWith(
			expect.objectContaining({ isCritical: true, isMiss: false }),
		);
	});

	it('still records the card line when Feature Effects are off, and skips the rules', async () => {
		const { sourceRule, targetRule } = placeActors();
		settingsGet.mockReturnValue(false);
		const card = createCard();

		emit('createChatMessage', card);
		await flushAsync();

		expect(card.cardDamageBack.afterMiss).toHaveBeenCalledTimes(1);
		expect(sourceRule.onItemUsed).not.toHaveBeenCalled();
		expect(targetRule.onAttackReceived).not.toHaveBeenCalled();
	});

	it('skips attacks outside the incoming-attack scope', async () => {
		placeActors();
		const cards = [
			createCard({ id: 'opportunity', flags: { [SYSTEM_ID]: { opportunityAttack: true } } }),
			createCard({ id: 'minions', type: 'minionGroupAttack' }),
			createCard({
				id: 'area',
				system: {
					activation: {
						acquireTargetsFromTemplate: true,
						template: { shape: 'circle' },
						effects: [DAMAGE],
					},
				},
			}),
			createCard({
				id: 'deferred',
				system: {
					activation: {
						effects: [{ type: 'damage', deferredRoll: true, roll: { class: 'DamageRoll' } }],
					},
				},
			}),
			createCard({
				id: 'no-roll',
				system: { activation: { effects: [{ type: 'savingThrow' }] } },
			}),
			createCard({ id: 'crit-miss', system: { isMiss: true, isCritical: true } }),
		];

		for (const card of cards) emit('createChatMessage', card);
		await flushAsync();

		expect(Hooks.callAll).not.toHaveBeenCalled();
		for (const card of cards) expect(card.cardDamageBack.afterMiss).not.toHaveBeenCalled();
	});

	it('runs only on the active GM', async () => {
		const { targetRule } = placeActors();
		activeGm.id = 'other-gm';
		const card = createCard();

		emit('createChatMessage', card);
		await flushAsync();

		expect(targetRule.onAttackReceived).not.toHaveBeenCalled();
		expect(card.setFlag).not.toHaveBeenCalled();
	});
});
