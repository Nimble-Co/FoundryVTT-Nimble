import { describe, expect, it } from 'vitest';
import { claimEscape } from '../claimEscape.ts';

describe('claimEscape', () => {
	it('keeps an Escape from the window', () => {
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		let reached = false;
		window.addEventListener('keydown', () => (reached = true), { once: true });
		document.body.addEventListener('keydown', (e) => expect(claimEscape(e)).toBe(true), {
			once: true,
		});

		document.body.dispatchEvent(event);

		expect(reached).toBe(false);
		expect(event.defaultPrevented).toBe(true);
	});

	it('lets every other key through', () => {
		const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

		expect(claimEscape(event)).toBe(false);
		expect(event.defaultPrevented).toBe(false);
	});
});
