import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NimbleTokenHUD from '../NimbleTokenHUD.svelte';

describe('NimbleTokenHUD', () => {
	const original = CONFIG.statusEffects;

	afterEach(() => {
		CONFIG.statusEffects = original;
	});

	// The palette is mounted inside core's HUD form. A submit button there lets Enter in a bar
	// field submit the whole form, which writes empty bar1 and bar2 data to the token.
	it('adds no submit button to the HUD form', () => {
		CONFIG.statusEffects = [
			{ id: 'blinded', name: 'Blinded', img: 'blinded.svg' },
			{ id: 'prone', name: 'Prone', img: 'prone.svg' },
		] as never;
		const form = document.createElement('form');
		document.body.append(form);
		const HUD = { actor: { conditionsMetadata: { active: new Set(), overlay: new Set() } } };

		render(NimbleTokenHUD, { target: form, props: { HUD } });

		const buttons = [...form.querySelectorAll('button')];
		expect(buttons.length).toBe(3);
		expect(buttons.filter((button) => button.type !== 'button')).toEqual([]);
	});
});
