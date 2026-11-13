import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EffectDetailsTab from '../EffectDetailsTab.svelte';

const proseMirror = (
	foundry.applications as unknown as {
		elements: { HTMLProseMirrorElement: { create: () => HTMLElement } };
	}
).elements.HTMLProseMirrorElement;

const config = CONFIG as unknown as {
	NIMBLE: Record<string, unknown>;
	statusEffects: { id: string; name: string; img: string }[];
};
let saved: { nimble: unknown; status: unknown };

function makeEffect(statuses: string[]) {
	const effect = {
		statuses: new Set(statuses),
		disabled: false,
		description: '',
		origin: null,
		parent: { documentName: 'Item' },
		update: vi.fn(async () => undefined),
		get reactive() {
			return effect;
		},
	};
	return effect;
}

beforeEach(() => {
	saved = { nimble: config.NIMBLE, status: config.statusEffects };
	config.NIMBLE = { ...(config.NIMBLE ?? {}), conditions: { prone: 'Prone', blinded: 'Blinded' } };
	config.statusEffects = [];
	vi.spyOn(proseMirror, 'create').mockImplementation(() => document.createElement('div'));
});

afterEach(() => {
	config.NIMBLE = saved.nimble as Record<string, unknown>;
	config.statusEffects = saved.status as typeof config.statusEffects;
	vi.restoreAllMocks();
});

describe('EffectDetailsTab conditions', () => {
	it('adds a condition to the effect, and takes away one that it has', async () => {
		const effect = makeEffect(['prone']);
		render(EffectDetailsTab, { effect: effect as never });

		await fireEvent.click(screen.getByRole('button', { name: 'Blinded' }));
		expect(effect.update).toHaveBeenLastCalledWith({ statuses: ['prone', 'blinded'] });

		await fireEvent.click(screen.getByRole('button', { name: 'Prone' }));
		expect(effect.update).toHaveBeenLastCalledWith({ statuses: [] });
	});
});
