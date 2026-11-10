import { fireEvent, render } from '@testing-library/svelte';
import { createSubscriber } from 'svelte/reactivity';
import { describe, expect, it, vi } from 'vitest';
import { newMoment } from '#utils/lastsUntil/momentForm.js';
import type { Moment } from '#utils/lastsUntil/momentReached.js';
import localize from '#utils/localize.js';
import EffectLastsUntilTab from '../EffectLastsUntilTab.svelte';

const LU = 'NIMBLE.effectSheet.lastsUntil';
const word = (key: string, data?: Record<string, string>) => localize(key, data);

/** Like a document: plain data, and a `reactive` getter that a database update wakes. */
function makeEffect(lastsUntil: Moment[], duration: object = { value: null }) {
	let wake = () => {};
	const subscribe = createSubscriber((update) => {
		wake = update;
		return () => {
			wake = () => {};
		};
	});
	const effect = {
		duration,
		system: { lastsUntil, escape: { dc: '', saves: 'strOrDex' } },
		update: vi.fn(async (data: Record<string, unknown>) => {
			if ('system.lastsUntil' in data) {
				effect.system = { ...effect.system, lastsUntil: data['system.lastsUntil'] as Moment[] };
			}
			wake();
		}),
		get reactive() {
			subscribe();
			return effect;
		},
	};
	return effect;
}

function renderTab(effect: ReturnType<typeof makeEffect>) {
	return render(EffectLastsUntilTab, { effect: effect as never });
}

const field = (container: HTMLElement, label: string) =>
	container.querySelector(`[aria-label="${word(`${LU}.fields.${label}`)}"]`) as
		| HTMLSelectElement
		| HTMLInputElement;

const saved = (effect: ReturnType<typeof makeEffect>) =>
	(effect.update.mock.calls.at(-1) as unknown as [Record<string, Moment[]>])[0][
		'system.lastsUntil'
	];

describe('EffectLastsUntilTab', () => {
	it('says that an effect with no moment stays until someone removes it', () => {
		const { container } = renderTab(makeEffect([]));

		expect(container.textContent).toContain(word(`${LU}.none`));
		expect(container.textContent).toContain(word(`${LU}.until`));
	});

	it('shows an older core duration, which still ends the effect', () => {
		const { container } = renderTab(makeEffect([], { value: 1, label: '1 Round' }));

		expect(container.textContent).toContain(word(`${LU}.coreDuration`, { duration: '1 Round' }));
		expect(container.textContent).not.toContain(word(`${LU}.none`));
	});

	it('names each moment row for a screen reader', () => {
		const { container } = renderTab(makeEffect([newMoment('turn'), newMoment('time')]));

		const groups = [...container.querySelectorAll('[role="group"]')].map((group) =>
			group.getAttribute('aria-label'),
		);
		expect(groups).toEqual([
			word(`${LU}.moment`, { number: '1' }),
			word(`${LU}.moment`, { number: '2' }),
		]);
	});

	it('adds a moment from "add a moment..."', async () => {
		const effect = makeEffect([]);
		const { container } = renderTab(effect);

		await fireEvent.change(field(container, 'add'), { target: { value: 'turn' } });

		expect(saved(effect)).toEqual([newMoment('turn')]);
		expect(field(container, 'boundary')?.value, 'the new row shows').toBe('end');
	});

	it('reads a turn moment as its words, and a change saves the moment', async () => {
		const effect = makeEffect([newMoment('turn')]);
		const { container } = renderTab(effect);

		expect(field(container, 'boundary').value).toBe('end');
		expect(field(container, 'clock').value).toBe('holder');
		expect(field(container, 'span').value).toBe('nextTurn');

		await fireEvent.change(field(container, 'clock'), { target: { value: 'source' } });

		expect(saved(effect)).toEqual([{ ...newMoment('turn'), clock: 'source' }]);
	});

	it('a round has no Clock select', () => {
		const effect = makeEffect([{ ...newMoment('turn'), span: 'nextRound', clock: null }]);
		const { container } = renderTab(effect);

		expect(field(container, 'clock')).toBeNull();
		expect(container.textContent).toContain(` ${word(`${LU}.the`)} `);
	});

	it('a time moment saves a whole number', async () => {
		const effect = makeEffect([newMoment('time')]);
		const { container } = renderTab(effect);

		await fireEvent.change(field(container, 'value'), { target: { value: '3' } });

		expect(saved(effect)).toEqual([{ ...newMoment('time'), value: 3 }]);
	});

	it('an event offers the events of its subject', async () => {
		const effect = makeEffect([newMoment('event')]);
		const { container } = renderTab(effect);
		const events = () =>
			[...(field(container, 'event') as HTMLSelectElement).options].map((option) => option.value);

		expect(events()).toContain('move');
		expect(events()).not.toContain('useAgain');

		await fireEvent.change(field(container, 'subject'), { target: { value: 'source' } });

		expect(saved(effect)).toEqual([{ ...newMoment('event'), who: 'source' }]);
	});

	it('another effect ends: a name field', async () => {
		const effect = makeEffect([newMoment('effectEnds')]);
		const { container } = renderTab(effect);

		await fireEvent.change(field(container, 'effectName'), { target: { value: 'Rage' } });

		expect(saved(effect)).toEqual([{ ...newMoment('effectEnds'), effectName: 'Rage' }]);
	});

	it('the trash removes that moment only', async () => {
		const effect = makeEffect([newMoment('turn'), newMoment('time')]);
		const { container } = renderTab(effect);

		const [first] = container.querySelectorAll(
			`[aria-label^="${word(`${LU}.remove`, { number: '1' }).slice(0, -1)}"]`,
		);
		await fireEvent.click(first);

		expect(saved(effect)).toEqual([newMoment('time')]);
	});

	it('saves the Escape DC and saves', async () => {
		const effect = makeEffect([]);
		const { container } = renderTab(effect);

		const dc = container.querySelector(
			`[aria-label="${word('NIMBLE.effectSheet.escape.dcLabel')}"]`,
		) as HTMLInputElement;
		await fireEvent.change(dc, { target: { value: ' 10 + @intelligence ' } });
		const saves = container.querySelector(
			`[aria-label="${word('NIMBLE.effectSheet.escape.savesLabel')}"]`,
		) as HTMLSelectElement;
		await fireEvent.change(saves, { target: { value: 'will' } });

		expect(effect.update).toHaveBeenCalledWith({ 'system.escape.dc': '10 + @intelligence' });
		expect(effect.update).toHaveBeenCalledWith({ 'system.escape.saves': 'will' });
	});
});
