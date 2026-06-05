import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('Hooks', { call: vi.fn().mockReturnValue(true), callAll: vi.fn() });

const { mockSetPoolFaces, mockBuildEffectiveDicePoolMap, mockDialogConfirm } = vi.hoisted(() => ({
	mockSetPoolFaces: vi.fn().mockResolvedValue(true),
	mockBuildEffectiveDicePoolMap: vi.fn(() => ({}) as Record<string, { faces: number[] }>),
	mockDialogConfirm: vi.fn().mockResolvedValue(true),
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

vi.stubGlobal('foundry', {
	applications: {
		api: {
			DialogV2: { confirm: mockDialogConfirm },
		},
	},
	utils: {
		getProperty: (_obj: unknown, _path: string) => undefined,
	},
});

import { findToggleEffectAE, findToggleEffectRule, toggleEffectAE } from './toggleEffectControl.js';

describe('toggleEffectControl', () => {
	beforeEach(() => {
		mockSetPoolFaces.mockClear();
		mockBuildEffectiveDicePoolMap.mockClear();
		mockBuildEffectiveDicePoolMap.mockReturnValue({});
		mockDialogConfirm.mockClear();
		mockDialogConfirm.mockResolvedValue(true);
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

	describe('toggleEffectAE — enable path', () => {
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
	});

	// TODO(follow-up): unit tests for toggleEffectAE disable path —
	// confirmEndPrompt skip when pool empty, prompt + confirm/cancel branches.
	// Requires mocking buildEffectiveDicePoolMap which doesn't intercept
	// cleanly in the current vi.mock setup. Integration-verified manually.
});
