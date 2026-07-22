import { afterEach, describe, expect, it } from 'vitest';
import { NimbleBaseRule } from '../../models/rules/base.js';
import { NimbleBaseItem } from './base.svelte.js';

// isAutoApplyEnabled() reads game.settings.get(); the default test mock has no
// settings, so we install a stub whose return value each test controls.
function setAutomation(enabled: boolean) {
	const globalWithGame = globalThis as { game?: Record<string, unknown> };
	globalWithGame.game ??= {};
	globalWithGame.game.settings = { get: () => enabled };
}

afterEach(() => {
	const globalWithGame = globalThis as { game?: Record<string, unknown> };
	if (globalWithGame.game) globalWithGame.game.settings = undefined;
});

class AutoSuppressingRule extends NimbleBaseRule {
	protected override _autoSuppressesActivationCard(): boolean {
		return true;
	}
}

function createRule(
	RuleClass: typeof NimbleBaseRule | typeof AutoSuppressingRule,
	{ suppressActivationCard = 'auto', disabled = false } = {},
): NimbleBaseRule {
	const rule = new (RuleClass as any)(
		{ type: 'test', label: '', identifier: '', predicate: {} },
		{ strict: false },
	);
	rule.suppressActivationCard = suppressActivationCard;
	rule.disabled = disabled;
	return rule as NimbleBaseRule;
}

function shouldSuppress(
	rules: NimbleBaseRule[],
	{ rolls = [] as unknown[], activation = null as { effects?: unknown[] } | null } = {},
): boolean {
	const stub = { rules: new Map(rules.map((rule, i) => [String(i), rule])) };
	// Bracket access: the method is protected, so dot access is a type error here.
	return NimbleBaseItem.prototype['_shouldSuppressActivationCard'].call(
		stub as unknown as InstanceType<typeof NimbleBaseItem>,
		rolls,
		activation,
	);
}

describe('NimbleBaseItem#_shouldSuppressActivationCard', () => {
	it('suppresses an `always` rule with automation off', () => {
		setAutomation(false);
		expect(shouldSuppress([createRule(NimbleBaseRule, { suppressActivationCard: 'always' })])).toBe(
			true,
		);
	});

	it('does not suppress an auto-resolving rule with automation off', () => {
		setAutomation(false);
		expect(shouldSuppress([createRule(AutoSuppressingRule)])).toBe(false);
	});

	it('suppresses an auto-resolving rule with automation on', () => {
		setAutomation(true);
		expect(shouldSuppress([createRule(AutoSuppressingRule)])).toBe(true);
	});

	it('never suppresses when the activation carries rolls', () => {
		setAutomation(true);
		expect(
			shouldSuppress([createRule(NimbleBaseRule, { suppressActivationCard: 'always' })], {
				rolls: [{}],
			}),
		).toBe(false);
	});

	it('never suppresses when the activation carries effect nodes', () => {
		setAutomation(true);
		expect(
			shouldSuppress([createRule(NimbleBaseRule, { suppressActivationCard: 'always' })], {
				activation: { effects: [{}] },
			}),
		).toBe(false);
	});

	it('ignores a disabled `always` rule', () => {
		setAutomation(true);
		expect(
			shouldSuppress([
				createRule(NimbleBaseRule, { suppressActivationCard: 'always', disabled: true }),
			]),
		).toBe(false);
	});

	it('suppresses when an enabled `always` rule sits alongside a disabled one', () => {
		setAutomation(true);
		expect(
			shouldSuppress([
				createRule(NimbleBaseRule, { suppressActivationCard: 'always', disabled: true }),
				createRule(NimbleBaseRule, { suppressActivationCard: 'always' }),
			]),
		).toBe(true);
	});

	it('does not let a `never` rule veto another rule that suppresses', () => {
		setAutomation(true);
		expect(
			shouldSuppress([
				createRule(NimbleBaseRule, { suppressActivationCard: 'never' }),
				createRule(NimbleBaseRule, { suppressActivationCard: 'always' }),
			]),
		).toBe(true);
	});

	it('posts the card when no rule suppresses', () => {
		setAutomation(true);
		expect(shouldSuppress([createRule(NimbleBaseRule)])).toBe(false);
	});
});
