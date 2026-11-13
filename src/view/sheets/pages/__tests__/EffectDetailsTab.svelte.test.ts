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

describe('EffectDetailsTab stacks', () => {
	const stacked = (stacks: object, parent: object = { documentName: 'Item' }) =>
		Object.assign(makeEffect([]), { parent, system: { stacks } });
	const on = { on: true, count: 2, at: 3, effectId: '' };

	it('turns Stacks on, and shows the count that gives an effect only then', async () => {
		const effect = stacked({ ...on, on: false });
		render(EffectDetailsTab, { effect: effect as never });

		expect(screen.queryByRole('spinbutton', { name: 'Stacks that give the effect' })).toBeNull();
		await fireEvent.click(screen.getByRole('checkbox', { name: /A new application adds a stack/ }));
		expect(effect.update).toHaveBeenLastCalledWith({ 'system.stacks.on': true });
	});

	it('saves "At [N] stacks" on an item effect, and has no "Stacks now"', async () => {
		const effect = stacked(on);
		render(EffectDetailsTab, { effect: effect as never });

		const at = screen.getByRole('spinbutton', { name: 'Stacks that give the effect' });
		expect(at).toHaveValue(3);
		await fireEvent.change(at, { target: { value: '4' } });
		expect(effect.update).toHaveBeenLastCalledWith({ 'system.stacks.at': 4 });
		expect(screen.queryByRole('spinbutton', { name: 'Stacks now' })).toBeNull();
	});

	it('on a creature, saves "Stacks now", and the item sets what the count gives', async () => {
		const effect = stacked(on, { documentName: 'Actor' });
		render(EffectDetailsTab, { effect: effect as never });

		expect(screen.getByRole('spinbutton', { name: 'Stacks that give the effect' })).toBeDisabled();
		const now = screen.getByRole('spinbutton', { name: 'Stacks now' });
		expect(now).toHaveValue(2);
		await fireEvent.change(now, { target: { value: '5' } });
		expect(effect.update).toHaveBeenLastCalledWith({ 'system.stacks.count': 5 });
	});
});
