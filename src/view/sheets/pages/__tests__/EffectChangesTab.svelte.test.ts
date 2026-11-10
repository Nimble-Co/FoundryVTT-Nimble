import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import localize from '#utils/localize.js';
import EffectChangesTab from '../EffectChangesTab.svelte';

const CH = 'NIMBLE.effectSheet.changes';
const effectClass = ActiveEffect as unknown as { CHANGE_TYPES?: unknown };

interface Change {
	key: string;
	type: string;
	value: unknown;
	phase: string;
	priority: number | null;
}

function makeEffect(changes: Change[]) {
	const effect = {
		system: { changes },
		update: vi.fn(async () => undefined),
		get reactive() {
			return effect;
		},
	};
	return effect;
}

const STR: Change = {
	key: 'system.abilities.strength.bonus',
	type: 'add',
	value: 1,
	phase: 'initial',
	priority: null,
};

beforeEach(() => {
	effectClass.CHANGE_TYPES = {
		add: { label: 'Add', defaultPriority: 20 },
		override: { label: 'Override', defaultPriority: 50 },
	};
});

afterEach(() => {
	delete effectClass.CHANGE_TYPES;
});

const saved = (effect: ReturnType<typeof makeEffect>) =>
	(effect.update.mock.calls.at(-1) as unknown as [Record<string, Change[]>])[0]['system.changes'];

const byLabel = (container: HTMLElement, key: string) =>
	[...container.querySelectorAll(`[aria-label="${localize(`${CH}.${key}`)}"]`)] as (
		| HTMLInputElement
		| HTMLSelectElement
	)[];

describe('EffectChangesTab', () => {
	it('adds a blank change', async () => {
		const effect = makeEffect([]);
		const { container } = render(EffectChangesTab, { effect: effect as never });

		await fireEvent.click(byLabel(container, 'add')[0]);

		expect(saved(effect)).toEqual([
			{ key: '', type: 'add', value: '', phase: 'initial', priority: null },
		]);
	});

	it('shows a change, with the default priority of its type as the hint', () => {
		const { container } = render(EffectChangesTab, { effect: makeEffect([STR]) as never });

		expect(byLabel(container, 'key')[0].value).toBe(STR.key);
		expect(byLabel(container, 'value')[0].value).toBe('1');
		expect((byLabel(container, 'priority')[0] as HTMLInputElement).placeholder).toBe('20');
	});

	it('stores a value that reads as JSON as that value, and other text as text', async () => {
		const effect = makeEffect([STR]);
		const { container } = render(EffectChangesTab, { effect: effect as never });

		await fireEvent.change(byLabel(container, 'value')[0], { target: { value: '3' } });
		expect(saved(effect)[0].value).toBe(3);

		await fireEvent.change(byLabel(container, 'value')[0], { target: { value: '@level' } });
		expect(saved(effect)[0].value).toBe('@level');
	});

	it('changes the type, and the trash removes the change', async () => {
		const effect = makeEffect([STR]);
		const { container } = render(EffectChangesTab, { effect: effect as never });

		await fireEvent.change(byLabel(container, 'type')[0], { target: { value: 'override' } });
		expect(saved(effect)[0].type).toBe('override');

		await fireEvent.click(byLabel(container, 'remove')[0]);
		expect(saved(effect)).toEqual([]);
	});
});
