import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import type { ResultChangeLine } from '#types/components/ResultChangeLines.d.ts';
import ResultChangeLines from '../ResultChangeLines.svelte';

const NOTE = 'Remove does not give back actions after the turn ends';

function line(note: string | null): ResultChangeLine {
	return {
		id: 'line-1',
		verb: 'Succeeded',
		withFeature: 'with Elusive',
		sentence: 'Succeeded with Elusive',
		detail: null,
		retired: false,
		canRemove: true,
		note,
	};
}

function renderLines(note: string | null) {
	render(ResultChangeLines, {
		props: {
			lines: [line(note)],
			held: { has: () => false, hold: vi.fn(), release: vi.fn() },
			onremove: vi.fn(async () => {}),
		},
	});
	return screen.getByRole('button', { name: 'Remove: Succeeded with Elusive' });
}

describe('the Remove button of a Change a Result line', () => {
	it("is described by the line's note", () => {
		const button = renderLines(NOTE);

		const noteId = button.getAttribute('aria-describedby');
		expect(noteId).toBeTruthy();
		expect(document.getElementById(noteId ?? '')?.textContent).toBe(NOTE);
	});

	it('has no description with no note', () => {
		expect(renderLines(null).hasAttribute('aria-describedby')).toBe(false);
	});
});
