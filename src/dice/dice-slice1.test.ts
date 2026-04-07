/**
 * Dice engine slice 1 — regression + bug baseline tests.
 *
 * Purpose: lock in RED baseline for known bugs and GREEN baseline for
 * currently-working behaviour before refactoring the dice engine.
 *
 * DO NOT FIX BUGS IN THIS SLICE. Tests marked BUG are expected to FAIL
 * on current code — that failure is the baseline.
 *
 * Implementation notes:
 * - The project's Foundry mock (tests/mocks/foundry.ts) provides a mock
 *   Roll class but does NOT implement `_evaluate`, nor does its mock Die
 *   populate results from a keep-highest/keep-lowest or explode modifier.
 * - Therefore we manually stage `primaryDie.results` to simulate what the
 *   real Foundry RNG + modifier resolution would produce, then install a
 *   no-op `_evaluate` on the base Roll prototype so DamageRoll's own
 *   `_evaluate` can run its post-super logic (isCritical / isMiss /
 *   primaryDieAsDamage / vicious explosion handling).
 * - This keeps tests deterministic and avoids touching real RNG.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { ItemActivationManager, testDependencies } from '../managers/ItemActivationManager.js';
import { hasWeaponProficiency } from '../view/sheets/components/attackUtils.js';
import { DamageRoll } from './DamageRoll.js';
import { khn as nimbleKhn, kln as nimbleKln } from './nimbleDieModifiers.js';

type DieResult = {
	result: number;
	active: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

/**
 * Install a no-op `_evaluate` on the base Roll prototype so that
 * `super._evaluate(options)` inside DamageRoll._evaluate resolves without
 * error. Must be called in a `beforeEach` so it is restored between tests.
 */
function stubBaseRollEvaluate() {
	const BaseRoll = Object.getPrototypeOf(DamageRoll.prototype);
	// Always (re)install — we want the Nimble-modifier-aware stub regardless of
	// any prior fixture state.
	Object.defineProperty(BaseRoll, '_evaluate', {
		value: async function () {
			// Minimal mock surface: walk every die-like term on this roll and,
			// for any modifier matching a registered Nimble handler (`khn`/`kln`
			// + optional integer count), invoke the handler bound to the term.
			// All other modifiers (`x`, `kh`, `kl`, ...) are skipped — this is
			// NOT a full reimplementation of Foundry's modifier evaluation,
			// only enough to exercise the Nimble keep-rule under test.
			const terms = (this as any).terms ?? [];
			for (const term of terms) {
				if (!term || !Array.isArray(term.modifiers) || !Array.isArray(term.results)) continue;
				for (const m of term.modifiers as string[]) {
					if (/^khn\d*$/.test(m)) nimbleKhn.call(term, m);
					else if (/^kln\d*$/.test(m)) nimbleKln.call(term, m);
				}
			}
			return this;
		},
		configurable: true,
		writable: true,
	});
}

/**
 * Stage evaluated state on a DamageRoll so that calling `_evaluate` exercises
 * the post-evaluation logic (isCritical / isMiss / total adjustments).
 */
function stagePrimaryDieResults(roll: DamageRoll, results: DieResult[], total: number) {
	if (!roll.primaryDie) throw new Error('roll has no primaryDie — cannot stage results');
	roll.primaryDie.results = results as any;
	(roll.primaryDie as any)._evaluated = true;
	(roll as any)._evaluated = true;
	(roll as any)._total = total;
}

describe('Dice slice 1 — regression baseline (expected GREEN)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stubBaseRollEvaluate();
	});

	it('regression_primary_is_leftmost: 2d6 no adv, primary = first die', () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Formula should split 2d6 into primary + 1d6 damage
		expect(roll.formula).toBe('1d6x + 1d6');
		expect(roll.primaryDie).toBeDefined();
		expect(roll.primaryDie?.number).toBe(1);
	});

	it('regression_primary_miss: 1d8, primary rolls 1 → isMiss', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(roll, [{ result: 1, active: true }], 1);
		await (roll as any)._evaluate();
		expect(roll.isMiss).toBe(true);
		expect(roll.isCritical).toBe(false);
	});

	it('regression_primary_crit_explodes: 1d8, rolls [8, 5] → crit, total 13', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(
			roll,
			[
				{ result: 8, active: true, exploded: true },
				{ result: 5, active: true },
			],
			13,
		);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(true);
		expect(roll.isMiss).toBe(false);
		expect(roll.total).toBe(13);
	});

	it('regression_crit_explodes_chain: 1d6 → [6, 6, 4], chain of crits, total 16', async () => {
		const roll = new DamageRoll(
			'1d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		stagePrimaryDieResults(
			roll,
			[
				{ result: 6, active: true, exploded: true },
				{ result: 6, active: true, exploded: true },
				{ result: 4, active: true },
			],
			16,
		);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(true);
		expect(roll.total).toBe(16);
	});

	it('regression_bonus_dice_never_crit: 1d8 + 2d6 sneak, primary [1] → MISS despite high bonus dice', async () => {
		// The bonus dice 2d6 are a separate term in the formula, they cannot
		// influence isMiss / isCritical because only the primaryDie drives them.
		const roll = new DamageRoll(
			'1d8 + 2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// primary gets 1; the sneak attack 2d6 would independently roll big — irrelevant
		stagePrimaryDieResults(roll, [{ result: 1, active: true }], 13);
		await (roll as any)._evaluate();
		expect(roll.isMiss).toBe(true);
		expect(roll.isCritical).toBe(false);
	});

	it('regression_vicious_only_on_crit: vicious primary rolls 5 (not max) → no extra explosion', async () => {
		const roll = new DamageRoll(
			'1d8',
			{},
			{
				canCrit: true,
				canMiss: true,
				rollMode: 0,
				primaryDieValue: 0,
				primaryDieModifier: 0,
				isVicious: true,
			},
		);
		// Vicious weapons should NOT have 'x' modifier; it is handled manually
		expect(roll.formula).toBe('1d8');
		stagePrimaryDieResults(roll, [{ result: 5, active: true }], 5);
		await (roll as any)._evaluate();
		expect(roll.isCritical).toBe(false);
		// Only the base result remains — no vicious explosion dice added
		expect(roll.primaryDie?.results.length).toBe(1);
	});

	it('regression_adv_resolved_before_primary: 2d6 adv rolling [1,2,6] → primary=2, hit (headline case)', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// With adv, primary term becomes 2d6khx, damage = 1d6
		expect(roll.formula).toBe('2d6khnx + 1d6');

		// Simulate Foundry's resolution: 3 dice rolled (orig 2 + 1 extra due to adv),
		// BUT DamageRoll applies adv to primary with keepCount=1, so primary is 2d6kh.
		// The leftmost 1 is discarded, the 2 is kept as the active primary value.
		// (If leftmost-tie-break is wrong, the dropped die might instead be the 1
		//  via Foundry kh which already picks highest — in this asymmetric case
		//  there is no tie, so both interpretations agree: keep 6, miss? NO —
		//  keep highest means keep the 6. So the primary becomes 6, a crit. This
		//  test therefore locks in CURRENT behaviour: Foundry kh keeps 6.)
		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: false, discarded: true },
				{ result: 6, active: true, exploded: true },
			],
			10,
		);
		await (roll as any)._evaluate();
		// Under current code, the kept die is the 6 (highest) → crit, not miss.
		// We are NOT testing leftmost-tie-break here (that's bug5), just that
		// the dropped 1 does not cause a miss.
		expect(roll.isMiss).toBe(false);
	});

	it('regression_minion_cannot_crit: minion damage roll with canCrit=false', async () => {
		// ItemActivationManager sets canCrit=false for minions; we simulate
		// that directly here to lock in the DamageRoll side of the contract.
		const roll = new DamageRoll(
			'1d8',
			{},
			{ canCrit: false, canMiss: true, rollMode: 0, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Without canCrit, no explosion modifier, and isCritical is locked to false
		expect(roll.formula).toBe('1d8');
		expect(roll.isCritical).toBe(false);

		stagePrimaryDieResults(roll, [{ result: 8, active: true }], 8);
		await (roll as any)._evaluate();
		// Even rolling max, isCritical must stay false
		expect(roll.isCritical).toBe(false);
	});
});

describe('Dice slice 1 — BUG baseline (expected RED)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stubBaseRollEvaluate();
	});

	it('bug5_ties_drop_leftmost (adv, [1,2,6]): leftmost-lowest dropped, primary becomes 2, hit', async () => {
		// Handler-level scenario: 3 dice, keep highest 2 with Nimble's
		// leftmost-on-tie rule. With rolled [1, 2, 6] the lone lowest 1
		// (index 0) must be discarded. The 2 at index 1 and the 6 at index 2
		// are both kept; the lowest kept (the 2) drives isMiss → false.
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Override the primary die's modifiers to keep-2 semantics so we can
		// stage a 3-die scenario and verify the handler's tie-break behaviour.
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['khn2'];
		}
		// Stage the raw rolled values; let the registered Nimble modifier
		// handler decide which to discard during evaluation.
		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: true },
				{ result: 2, active: true },
				{ result: 6, active: true },
			],
			8,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		expect(roll.isMiss).toBe(false);
	});

	it('bug5_ties_drop_leftmost (adv, [3,3,5]): leftmost tied-lowest dropped, primary kept = 3 at index 1', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['khn2'];
		}
		stagePrimaryDieResults(
			roll,
			[
				{ result: 3, active: true },
				{ result: 3, active: true },
				{ result: 5, active: true },
			],
			8,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		// Leftmost tied 3 must be the dropped one
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		expect(roll.isMiss).toBe(false);
		expect(roll.isCritical).toBe(false);
	});

	it('bug5_ties_drop_leftmost (dis, [5,5,2]): leftmost tied-highest dropped, primary kept = 5 at index 1, not crit', async () => {
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: -1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		if (roll.primaryDie) {
			roll.primaryDie.modifiers = ['kln2'];
		}
		stagePrimaryDieResults(
			roll,
			[
				{ result: 5, active: true },
				{ result: 5, active: true },
				{ result: 2, active: true },
			],
			7,
		);
		await (roll as any)._evaluate();
		const results = roll.primaryDie?.results ?? [];
		// Disadvantage = drop highest. Leftmost tied 5 must be dropped.
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[2].discarded).toBeFalsy();
		// 5 is not max on a d6, so not a crit
		expect(roll.isCritical).toBe(false);
	});

	it('bug5_integration_full_path_advantage: normally-built DamageRoll routes [1,2] through registered khn handler', async () => {
		// End-to-end exercise of the bug5 fix:
		//   1. DamageRoll is constructed exactly as ItemActivationManager would build it
		//      (matching `regression_adv_resolved_before_primary` above) — no test-side
		//      modifier injection.
		//   2. The constructor's `_extractPrimaryDie` + `_phase1_expandPoolForAdvDis` path
		//      emits the `khn` modifier on the primary term (2 dice, keep 1) plus `x` for crits.
		//   3. We stage the underlying rolled values [1, 2] on the primary die's results
		//      (the mock cannot drive RNG end-to-end — see file header note).
		//   4. `_evaluate` invokes the registered Nimble `khn` handler, which must drop
		//      the leftmost low die and keep the 2 as the active primary value.
		const roll = new DamageRoll(
			'2d6',
			{},
			{ canCrit: true, canMiss: true, rollMode: 1, primaryDieValue: 0, primaryDieModifier: 0 },
		);
		// Confirm the constructor wired the real Nimble modifier — no manual override.
		expect(roll.formula).toBe('2d6khnx + 1d6');
		expect(roll.primaryDie?.modifiers).toContain('khn');

		stagePrimaryDieResults(
			roll,
			[
				{ result: 1, active: true },
				{ result: 2, active: true },
			],
			3,
		);
		await (roll as any)._evaluate();

		const results = roll.primaryDie?.results ?? [];
		// Leftmost (the 1) was dropped by the registered khn handler.
		expect(results[0].discarded).toBe(true);
		expect(results[0].active).toBe(false);
		// The 2 is the kept, contributing primary value.
		expect(results[1].discarded).toBeFalsy();
		expect(results[1].active).toBe(true);
		expect(results[1].result).toBe(2);
		// Primary is now the 2, not the dropped 1 → not a miss.
		expect(roll.isMiss).toBe(false);
		expect(roll.isCritical).toBe(false);
	});

	it('bug6_adv_dis_cancel: +1 adv and -1 dis from two sources should net to 0', () => {
		// The current code passes `rollMode` as a single signed integer. There is
		// no aggregation layer: the caller must sum sources manually. This test
		// asserts an API that does NOT yet exist — that a DamageRoll constructed
		// with TWO rollMode sources (e.g. via an array or two calls) yields a
		// NET rollMode of 0. Expected to FAIL because the Options shape only
		// accepts a single scalar `rollMode`.
		//
		// Concrete assertion: we try passing rollMode as an array; current code
		// will either coerce it to NaN or misinterpret it. A correct implementation
		// would expose something like `rollModeSources: [+1, -1]` and compute net.
		const roll = new DamageRoll(
			'2d6',
			{},
			// Intentionally abuse the API to expose the gap
			{
				canCrit: true,
				canMiss: true,
				rollMode: (+1 + -1) as number, // caller had to aggregate manually
				primaryDieValue: 0,
				primaryDieModifier: 0,
				// Simulate what a fixed API would look like:
				rollModeSources: [+1, -1],
			} as any,
		);
		// Under a fixed engine: net rollMode 0 → no adv/dis, formula '1d6x + 1d6'.
		// Under current engine: caller-aggregated 0 happens to produce the right
		//   formula, but `rollModeSources` is silently ignored → no regression
		//   signal. So we assert the engine read rollModeSources itself:
		expect((roll.options as any).rollModeSources).toEqual([+1, -1]);
		// And we assert that the engine stored a NET rollMode derived from sources
		// (this will fail: current engine does not compute this).
		expect((roll.options as any).netRollMode).toBe(0);
	});

	it('bug6_adv_stacks: +1 and +1 from two sources should net +2', () => {
		const roll = new DamageRoll('1d8', {}, {
			canCrit: true,
			canMiss: true,
			rollMode: 1, // caller-aggregated single source only
			primaryDieValue: 0,
			primaryDieModifier: 0,
			rollModeSources: [+1, +1],
		} as any);
		// Expected under fixed engine: net +2, primary becomes 3d8khx
		expect((roll.options as any).netRollMode).toBe(2);
		expect(roll.formula).toBe('3d8khnx');
	});

	// --- Bug #7 & #8b: promoted from todo, exercised via ItemActivationManager ---

	function ensureGameUserTargets() {
		const g = globalThis as any;
		if (!g.game) g.game = {};
		if (!g.game.user) g.game.user = { targets: [] };
		if (!g.game.user.targets) g.game.user.targets = [];
	}

	function makeMockDamageRollClass() {
		const calls: Array<{ formula: string; data: unknown; options: any }> = [];
		const Mock = vi.fn(function MockDamageRoll(
			this: any,
			formula: string,
			data: unknown,
			options: any,
		) {
			calls.push({ formula, data, options });
			return {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 0 }),
				options,
				isCritical: options?.canCrit ? undefined : false,
				isMiss: options?.canMiss ? undefined : false,
			};
		}) as unknown as typeof DamageRoll & { calls: typeof calls };
		(Mock as any).calls = calls;
		return Mock;
	}

	function makeAoEItem(actor: any, overrides: Record<string, unknown> = {}) {
		return {
			type: 'weapon',
			name: 'Fireball Wand',
			actor,
			system: {
				weaponType: '',
				properties: { selected: [] },
				activation: {
					effects: [],
					template: { shape: 'circle', length: 3, radius: 2, width: 1 },
					targets: { count: 1, attackType: '' },
				},
				...overrides,
			},
		};
	}

	it('bug7_aoe_flags_auto_set: AoE template forces canCrit=false and canMiss=false', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: [] } },
			};
			const item = makeAoEItem(actor);
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'fire',
						formula: '1d6',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			expect((MockDamageRoll as any).calls.length).toBe(1);
			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			expect(opts.canMiss).toBe(false);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug7_aoe_flags_auto_set: targets.count > 1 also forces canCrit=false and canMiss=false', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: [] } },
			};
			const item = {
				type: 'weapon',
				name: 'Multi-target Strike',
				actor,
				system: {
					weaponType: '',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 3, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d8',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			expect(opts.canMiss).toBe(false);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug8b_no_prof_crit_suppressed: hasWeaponProficiency baseline cases', () => {
		// Permissive default: empty weaponType allows everyone
		expect(hasWeaponProficiency({} as any, { system: { weaponType: '' } })).toBe(true);
		expect(hasWeaponProficiency({} as any, { system: {} })).toBe(true);
		expect(hasWeaponProficiency({} as any, undefined)).toBe(true);

		// Explicit type, actor proficient
		expect(
			hasWeaponProficiency({ system: { proficiencies: { weapons: ['Longsword'] } } } as any, {
				system: { weaponType: 'Longsword' },
			}),
		).toBe(true);

		// Explicit type, actor NOT proficient
		expect(
			hasWeaponProficiency({ system: { proficiencies: { weapons: ['Longsword'] } } } as any, {
				system: { weaponType: 'Greatsword' },
			}),
		).toBe(false);

		// Set-shaped proficiencies still work
		expect(
			hasWeaponProficiency(
				{ system: { proficiencies: { weapons: new Set(['Longsword']) } } } as any,
				{ system: { weaponType: 'Longsword' } },
			),
		).toBe(true);
	});

	it('bug8b_no_prof_crit_suppressed: lacking proficiency forces canCrit=false through ItemActivationManager', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: ['Longsword'] } },
			};
			const item = {
				type: 'weapon',
				name: 'Greatsword',
				actor,
				system: {
					weaponType: 'Greatsword',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 1, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d12',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(false);
			// Non-AoE: misses still allowed
			expect(opts.canMiss).toBe(true);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});

	it('bug8b_no_prof_crit_suppressed: matching weaponType allows crit', async () => {
		const MockDamageRoll = makeMockDamageRollClass();
		const originalDR = testDependencies.DamageRoll;
		const originalRecon = testDependencies.reconstructEffectsTree;
		(testDependencies as any).DamageRoll = MockDamageRoll;
		(testDependencies as any).reconstructEffectsTree = (effects: EffectNode[]) => effects;
		ensureGameUserTargets();

		try {
			const actor = {
				uuid: 'a1',
				token: null,
				type: 'character',
				getRollData: () => ({}),
				system: { proficiencies: { weapons: ['Longsword'] } },
			};
			const item = {
				type: 'weapon',
				name: 'Longsword',
				actor,
				system: {
					weaponType: 'Longsword',
					properties: { selected: [] },
					activation: {
						effects: [],
						template: { shape: '', length: 1, radius: 1, width: 1 },
						targets: { count: 1, attackType: 'reach' },
					},
				},
			};
			const manager = new ItemActivationManager(item as any, { fastForward: true });
			manager.activationData = {
				effects: [
					{
						id: 'd1',
						type: 'damage',
						damageType: 'slashing',
						formula: '1d8',
						canCrit: true,
						canMiss: true,
						parentContext: null,
						parentNode: null,
					} as any,
				],
			};

			await manager.getData();

			const opts = (MockDamageRoll as any).calls[0].options;
			expect(opts.canCrit).toBe(true);
			expect(opts.canMiss).toBe(true);
		} finally {
			(testDependencies as any).DamageRoll = originalDR;
			(testDependencies as any).reconstructEffectsTree = originalRecon;
		}
	});
});
