import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import RuleCard from './RuleCard.svelte';

vi.stubGlobal('fromUuidSync', () => null);

// HTMLProseMirrorElement.create is mocked in tests/mocks/foundry.ts; return a
// real DOM node so onMount's `replaceWith` doesn't throw if a rule schema
// includes an HTMLField.
const proseMirrorMock = foundry.applications.elements.HTMLProseMirrorElement
	.create as unknown as ReturnType<typeof vi.fn>;
proseMirrorMock.mockImplementation(() => document.createElement('div'));

const mockManager = {
	updateRule: vi.fn().mockResolvedValue(undefined),
};

/**
 * Builds a minimal rule source object for a given rule type by reading
 * each schema field's initial value. This mirrors what `addRule` does at
 * runtime, but skips needing a real item/manager.
 */
function buildInitialRule(
	type: string,
	RuleClass: { defineSchema: () => Record<string, foundry.data.fields.DataField.Any> },
): Record<string, unknown> {
	const schema = RuleClass.defineSchema();
	const rule: Record<string, unknown> = { id: `test-${type}`, type };
	for (const [name, field] of Object.entries(schema)) {
		if (name in rule) continue;
		const initial = (field as { initial?: unknown }).initial;
		rule[name] = typeof initial === 'function' ? initial() : initial;
	}
	return rule;
}

describe('RuleCard renders every registered rule type', () => {
	const { ruleDataModels } = CONFIG.NIMBLE;
	const ruleEntries = Object.entries(ruleDataModels);

	it.each(ruleEntries)(
		'%s — renders without inline error or unsupported-field warnings',
		(type, RuleClass) => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const rule = buildInitialRule(
				type,
				RuleClass as unknown as {
					defineSchema: () => Record<string, foundry.data.fields.DataField.Any>;
				},
			);

			const { container } = render(RuleCard, {
				rule,
				manager: mockManager,
			});

			// The card itself mounted.
			expect(container.querySelector('.nimble-rule-card')).toBeTruthy();

			// No SchemaFieldRenderer fell through to the inline error block —
			// catches a rule schema using a field type the renderer doesn't
			// know how to dispatch (e.g. a SetField added without renderer
			// support, or a `widget` hint that isn't in the dispatch table).
			const errorBlock = container.querySelector('.nimble-renderer-error');
			expect(
				errorBlock,
				`RuleCard for "${type}" rendered an inline error block — likely an unsupported field type or invalid widget hint.`,
			).toBeFalsy();

			// The renderer warns to console for unsupported field types.
			// If a new rule introduces an un-dispatched field, this fires.
			const undispatchedWarnings = warnSpy.mock.calls.filter((args) =>
				args.some(
					(arg) =>
						typeof arg === 'string' && arg.includes('Nimble | SchemaFieldRenderer has no widget'),
				),
			);
			expect(
				undispatchedWarnings,
				`RuleCard for "${type}" produced renderer warnings: ${JSON.stringify(undispatchedWarnings)}`,
			).toHaveLength(0);

			warnSpy.mockRestore();
		},
	);
});
