import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import type { DieFaceProps } from '#types/components/DieFace.d.ts';
import DieFace from './DieFace.svelte';

function renderDie(props: DieFaceProps) {
	render(DieFace, { props });
	return screen.getByRole('img');
}

describe('DieFace', () => {
	it.each([4, 6, 8, 10, 12, 20])('draws a d%i with its own shape', (faces) => {
		const die = renderDie({ faces, value: 3 });

		expect(die).toHaveClass(`nimble-die-face--d${faces}`);
	});

	it.each([2, 7, 100])('draws a d6 for a d%i, which has no die icon', (faces) => {
		const die = renderDie({ faces, value: 2 });

		expect(die).toHaveClass('nimble-die-face--d6');
		expect(die.className).not.toMatch(/nimble-die-face--d(4|8|10|12|20)\b/);
	});

	it('tumbles with no number while the die is in the air', () => {
		const die = renderDie({ faces: 20, rolling: true });

		expect(die).toHaveClass('nimble-die-face--rolling');
		expect(die).toHaveClass('nimble-die-face--d20');
		expect(die.querySelector('.nimble-die-face__number')).toBeNull();
		expect(die).toHaveAccessibleName('Rolling the dice');
	});

	it('does not tumble once the die has landed', () => {
		const die = renderDie({ faces: 20, value: 17 });

		expect(die).not.toHaveClass('nimble-die-face--rolling');
	});

	it('shows the number once, hidden from screen readers', () => {
		const die = renderDie({ faces: 20, value: 17 });
		const number = die.querySelector('.nimble-die-face__number');

		expect(number).toHaveTextContent('17');
		expect(number).toHaveAttribute('aria-hidden', 'true');
	});

	it.each([
		{ outcome: null, discarded: false, classes: [], absent: ['crit', 'miss', 'discarded'] },
		{ outcome: 'crit', discarded: false, classes: ['crit'], absent: ['miss', 'discarded'] },
		{ outcome: 'miss', discarded: false, classes: ['miss'], absent: ['crit', 'discarded'] },
		{ outcome: null, discarded: true, classes: ['discarded'], absent: ['crit', 'miss'] },
		{ outcome: 'crit', discarded: true, classes: ['crit', 'discarded'], absent: ['miss'] },
		{ outcome: 'miss', discarded: true, classes: ['miss', 'discarded'], absent: ['crit'] },
	] as const)(
		'sets the state classes for outcome $outcome, discarded $discarded',
		({ outcome, discarded, classes, absent }) => {
			const die = renderDie({ faces: 8, value: 5, outcome, discarded });

			for (const name of classes) expect(die).toHaveClass(`nimble-die-face--${name}`);
			for (const name of absent) expect(die).not.toHaveClass(`nimble-die-face--${name}`);
		},
	);

	it('has no state classes when outcome and discarded are left out', () => {
		const die = renderDie({ faces: 6, value: 4 });

		expect(die).not.toHaveClass('nimble-die-face--crit');
		expect(die).not.toHaveClass('nimble-die-face--miss');
		expect(die).not.toHaveClass('nimble-die-face--discarded');
	});

	it.each([
		{ outcome: null, discarded: true, label: 'Was 3' },
		{ outcome: 'crit', discarded: true, label: 'Was 12, a crit' },
		{ outcome: 'miss', discarded: true, label: 'Was 1, a miss' },
		{ outcome: null, discarded: false, label: 'Now 3' },
		{ outcome: 'crit', discarded: false, label: 'Now 12, a crit' },
		{ outcome: 'miss', discarded: false, label: 'Now 1, a miss' },
	] as const)('reads "$label"', ({ outcome, discarded, label }) => {
		const value = Number(label.match(/\d+/)?.[0]);

		renderDie({ faces: 12, value, outcome, discarded });

		expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
	});
});
