import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSetPoolFaces, mockBuildEffectiveDicePoolMap } = vi.hoisted(() => ({
	mockSetPoolFaces: vi.fn().mockResolvedValue(true),
	mockBuildEffectiveDicePoolMap: vi.fn(() => ({}) as Record<string, { faces: number[] }>),
}));

vi.mock('#utils/dicePool/dicePoolRefill.js', () => ({
	setPoolFaces: mockSetPoolFaces,
}));

vi.mock('#utils/dicePool/helpers.js', () => ({
	buildEffectiveDicePoolMap: mockBuildEffectiveDicePoolMap,
}));

vi.mock('#utils/localize.js', () => ({
	default: (key: string) => key,
}));

// tests/setup.ts boots the system init hook, which eagerly imports the real
// dicePool modules before any per-file vi.mock can register. A static import
// of the module under test would therefore bind to those already-cached real
// modules and bypass the mocks above. Resetting the module registry and
// importing dynamically forces a fresh graph that resolves through the mocks.
let findToggleEffectRule: typeof import('./toggleEffectControl.js').findToggleEffectRule;
let findToggleEffectRuleById: typeof import('./toggleEffectControl.js').findToggleEffectRuleById;
let findToggleEffectAE: typeof import('./toggleEffectControl.js').findToggleEffectAE;
let isToggleEffectAE: typeof import('./toggleEffectControl.js').isToggleEffectAE;
let toggleEffectAE: typeof import('./toggleEffectControl.js').toggleEffectAE;
let endToggleEffectFromAE: typeof import('./toggleEffectControl.js').endToggleEffectFromAE;

beforeAll(async () => {
	vi.resetModules();
	({
		findToggleEffectRule,
		findToggleEffectRuleById,
		findToggleEffectAE,
		isToggleEffectAE,
		toggleEffectAE,
		endToggleEffectFromAE,
	} = await import('./toggleEffectControl.js'));
});

function getDialogConfirmMock(): Mock {
	const globalFoundry = (
		globalThis as unknown as {
			foundry: { applications: { api: { DialogV2: { confirm: Mock } } } };
		}
	).foundry;
	return globalFoundry.applications.api.DialogV2.confirm;
}

describe('toggleEffectControl', () => {
	beforeEach(() => {
		mockSetPoolFaces.mockClear();
		mockBuildEffectiveDicePoolMap.mockClear();
		mockBuildEffectiveDicePoolMap.mockReturnValue({});
		getDialogConfirmMock().mockReset();
		getDialogConfirmMock().mockResolvedValue(true);
	});

	describe('findToggleEffectRule', () => {
		it('returns the first non-disabled toggleEffect rule on the item', () => {
			const item = {
				rules: new Map([
					['0', { type: 'damageBonus' }],
					['1', { type: 'toggleEffect', id: 'rage-toggle', disabled: false }],
					['2', { type: 'toggleEffect', id: 'second', disabled: false }],
				]),
			};
			expect(findToggleEffectRule(item)?.id).toBe('rage-toggle');
		});

		it('skips disabled toggleEffect rules', () => {
			const item = {
				rules: new Map([
					['0', { type: 'toggleEffect', id: 'disabled', disabled: true }],
					['1', { type: 'toggleEffect', id: 'live', disabled: false }],
				]),
			};
			expect(findToggleEffectRule(item)?.id).toBe('live');
		});

		it('returns null when no toggleEffect rule exists', () => {
			const item = { rules: new Map([['0', { type: 'damageBonus' }]]) };
			expect(findToggleEffectRule(item)).toBeNull();
		});

		it('returns null when item has no rules collection', () => {
			expect(findToggleEffectRule({})).toBeNull();
			expect(findToggleEffectRule({ rules: undefined as never })).toBeNull();
		});
	});

	describe('findToggleEffectAE', () => {
		function mkEffect(id: string, ruleIdFlag: unknown, disabled = false) {
			return {
				id,
				disabled,
				getFlag: (scope: string, key: string): unknown => {
					if (scope === 'nimble' && key === 'toggleEffectRuleId') return ruleIdFlag;
					return undefined;
				},
			};
		}

		it('returns the AE whose toggleEffectRuleId flag matches the rule id', () => {
			const actor = {
				effects: [mkEffect('other', 'different-rule'), mkEffect('match', 'rage-toggle')],
			};
			expect(findToggleEffectAE(actor, 'rage-toggle')?.id).toBe('match');
		});

		it('returns null when no AE matches the rule id', () => {
			const actor = { effects: [mkEffect('a', 'unrelated')] };
			expect(findToggleEffectAE(actor, 'rage-toggle')).toBeNull();
		});

		it('returns null when actor has no effects collection', () => {
			expect(findToggleEffectAE(undefined, 'rage-toggle')).toBeNull();
			expect(findToggleEffectAE({}, 'rage-toggle')).toBeNull();
		});
	});

	describe('toggleEffectAE: enable path', () => {
		it('creates a new AE when none exists, flagged with rule + item ids', async () => {
			const createSpy = vi.fn().mockResolvedValue([]);
			const actor = {
				effects: [] as Array<{
					id: string;
					disabled: boolean;
					getFlag?: (s: string, k: string) => unknown;
				}>,
				createEmbeddedDocuments: createSpy,
				deleteEmbeddedDocuments: vi.fn(),
			};
			const item = { id: 'rage-item', name: 'Rage', img: 'rage.webp', uuid: 'Actor.X.Item.Rage' };
			const rule = { type: 'toggleEffect', id: 'rage-toggle' };

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(createSpy).toHaveBeenCalledTimes(1);
			const [type, payload] = createSpy.mock.calls[0];
			expect(type).toBe('ActiveEffect');
			expect(payload[0]).toMatchObject({
				name: 'Rage',
				img: 'rage.webp',
				disabled: false,
				origin: 'Actor.X.Item.Rage',
				flags: {
					nimble: { toggleEffectRuleId: 'rage-toggle', toggleEffectItemId: 'rage-item' },
				},
			});
		});

		it('names the AE after the rule label when one is set', async () => {
			const createSpy = vi.fn().mockResolvedValue([]);
			const actor = {
				effects: [],
				createEmbeddedDocuments: createSpy,
				deleteEmbeddedDocuments: vi.fn(),
			};
			const item = { id: 'rage-item', name: 'Rage Feature', img: 'rage.webp' };
			const rule = { type: 'toggleEffect', id: 'rage-toggle', label: 'Raging' };

			await toggleEffectAE(actor, item, rule);

			expect(createSpy.mock.calls[0][1][0]).toMatchObject({ name: 'Raging' });
		});
	});

	describe('toggleEffectAE: disable path', () => {
		function mkActorWithAE(ruleId: string) {
			const effect = {
				id: 'ae-active',
				disabled: false,
				getFlag: (scope: string, key: string): unknown => {
					if (scope === 'nimble' && key === 'toggleEffectRuleId') return ruleId;
					return undefined;
				},
			};
			return {
				effects: [effect],
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};
		}

		const item = { id: 'rage-item', name: 'Rage', img: 'rage.webp', uuid: 'Actor.X.Item.Rage' };

		it('deletes the AE without prompting when the rule has no confirmEndPrompt', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = { type: 'toggleEffect', id: 'rage-toggle', clearPoolsOnEnd: ['fury'] };
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4, 2] } });

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(getDialogConfirmMock()).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('skips the prompt when every linked pool is empty (nothing to lose)', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				confirmEndPrompt: 'NIMBLE.confirmKey',
				clearPoolsOnEnd: ['fury'],
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [] } });

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(getDialogConfirmMock()).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('prompts and proceeds on confirm: clears pools, then deletes the AE', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				label: 'Rage',
				confirmEndPrompt: 'NIMBLE.confirmKey',
				clearPoolsOnEnd: ['fury'],
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4] } });
			getDialogConfirmMock().mockResolvedValue(true);

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(getDialogConfirmMock()).toHaveBeenCalledTimes(1);
			expect(mockSetPoolFaces).toHaveBeenCalledWith(actor, 'fury', []);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('cancelling the prompt keeps the AE and the pools untouched', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				confirmEndPrompt: 'NIMBLE.confirmKey',
				clearPoolsOnEnd: ['fury'],
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4] } });
			getDialogConfirmMock().mockResolvedValue(false);

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(false);
			expect(mockSetPoolFaces).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('treats a dismissed dialog (null) as cancel', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				confirmEndPrompt: 'NIMBLE.confirmKey',
				clearPoolsOnEnd: ['fury'],
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4] } });
			getDialogConfirmMock().mockResolvedValue(null);

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(false);
			expect(mockSetPoolFaces).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('renders a plain-text confirmEndPrompt directly in the dialog (homebrew)', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				confirmEndPrompt: 'You will lose all your Fury Dice. End it?',
				clearPoolsOnEnd: ['fury'],
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4] } });
			getDialogConfirmMock().mockResolvedValue(true);

			await toggleEffectAE(actor, item, rule);

			const dialogArgs = getDialogConfirmMock().mock.calls[0][0] as { content: string };
			expect(dialogArgs.content).toContain('You will lose all your Fury Dice. End it?');
		});

		it('clears every listed pool before deleting the AE, skipping blank ids', async () => {
			const actor = mkActorWithAE('rage-toggle');
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				clearPoolsOnEnd: ['fury', '  ', '', 'focus'],
			};

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(mockSetPoolFaces).toHaveBeenCalledTimes(2);
			expect(mockSetPoolFaces).toHaveBeenNthCalledWith(1, actor, 'fury', []);
			expect(mockSetPoolFaces).toHaveBeenNthCalledWith(2, actor, 'focus', []);

			const lastPoolClearOrder = Math.max(...mockSetPoolFaces.mock.invocationCallOrder);
			const deleteOrder = actor.deleteEmbeddedDocuments.mock.invocationCallOrder[0];
			expect(lastPoolClearOrder).toBeLessThan(deleteOrder);
		});

		it('flips ON (creates) rather than entering the disable path when no AE exists', async () => {
			const actor = {
				effects: [],
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};
			const rule = { type: 'toggleEffect', id: 'rage-toggle', clearPoolsOnEnd: ['fury'] };

			const ok = await toggleEffectAE(actor, item, rule);

			expect(ok).toBe(true);
			expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
			expect(mockSetPoolFaces).not.toHaveBeenCalled();
		});
	});

	describe('isToggleEffectAE', () => {
		it('identifies AEs carrying the toggleEffectRuleId flag', () => {
			const toggleAE = {
				getFlag: (scope: string, key: string) =>
					scope === 'nimble' && key === 'toggleEffectRuleId' ? 'rage-toggle' : undefined,
			};
			const plainAE = { getFlag: () => undefined };
			expect(isToggleEffectAE(toggleAE)).toBe(true);
			expect(isToggleEffectAE(plainAE)).toBe(false);
			expect(isToggleEffectAE({} as never)).toBe(false);
		});
	});

	describe('findToggleEffectRuleById', () => {
		it('matches by rule id, including disabled rules', () => {
			const item = {
				rules: new Map([
					['0', { type: 'toggleEffect', id: 'other', disabled: false }],
					['1', { type: 'toggleEffect', id: 'rage-toggle', disabled: true }],
				]),
			};
			expect(findToggleEffectRuleById(item, 'rage-toggle')?.id).toBe('rage-toggle');
			expect(findToggleEffectRuleById(item, 'missing')).toBeNull();
			expect(findToggleEffectRuleById({}, 'rage-toggle')).toBeNull();
		});
	});

	describe('endToggleEffectFromAE', () => {
		function mkToggleAE(id = 'ae-active', ruleId = 'rage-toggle', itemId = 'rage-item') {
			return {
				id,
				disabled: false,
				getFlag: (scope: string, key: string): unknown => {
					if (scope !== 'nimble') return undefined;
					if (key === 'toggleEffectRuleId') return ruleId;
					if (key === 'toggleEffectItemId') return itemId;
					return undefined;
				},
			};
		}

		it('routes through the rule disable path when item and rule resolve', async () => {
			const effect = mkToggleAE();
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				clearPoolsOnEnd: ['fury'],
			};
			const actor = {
				effects: [effect],
				items: {
					get: (id: string) =>
						id === 'rage-item'
							? { id: 'rage-item', name: 'Rage', rules: new Map([['0', rule]]) }
							: undefined,
				},
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};

			const ok = await endToggleEffectFromAE(actor, effect);

			expect(ok).toBe(true);
			expect(mockSetPoolFaces).toHaveBeenCalledWith(actor, 'fury', []);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('deletes the AE directly when the owning item is gone', async () => {
			const effect = mkToggleAE();
			const actor = {
				effects: [effect],
				items: { get: () => undefined },
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};

			const ok = await endToggleEffectFromAE(actor, effect);

			expect(ok).toBe(true);
			expect(mockSetPoolFaces).not.toHaveBeenCalled();
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('deletes the AE directly when the rule no longer exists on the item', async () => {
			const effect = mkToggleAE();
			const actor = {
				effects: [effect],
				items: {
					get: () => ({ id: 'rage-item', name: 'Rage', rules: new Map() }),
				},
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};

			const ok = await endToggleEffectFromAE(actor, effect);

			expect(ok).toBe(true);
			expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['ae-active']);
		});

		it('propagates a user cancel from the confirm prompt', async () => {
			const effect = mkToggleAE();
			const rule = {
				type: 'toggleEffect',
				id: 'rage-toggle',
				confirmEndPrompt: 'NIMBLE.confirmKey',
				clearPoolsOnEnd: ['fury'],
			};
			const actor = {
				effects: [effect],
				items: {
					get: () => ({ id: 'rage-item', name: 'Rage', rules: new Map([['0', rule]]) }),
				},
				createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
				deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			};
			mockBuildEffectiveDicePoolMap.mockReturnValue({ fury: { faces: [4] } });
			getDialogConfirmMock().mockResolvedValue(false);

			const ok = await endToggleEffectFromAE(actor, effect);

			expect(ok).toBe(false);
			expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		});
	});
});
