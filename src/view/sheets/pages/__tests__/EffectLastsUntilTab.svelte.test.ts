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
		system: { lastsUntil, escape: { dc: '', saves: ['strength', 'dexterity'] } },
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

	it("reads a condition's own Lasts Until for an effect on an item, never on a creature", () => {
		const config = CONFIG as unknown as { statusEffects?: unknown };
		const saved = config.statusEffects;
		config.statusEffects = [
			{ id: 'dazed', name: 'Dazed', system: { lastsUntil: [newMoment('turn')] } },
		];
		const withStatus = (parent: unknown) =>
			Object.assign(makeEffect([]), { statuses: new Set(['dazed']), parent });
		const onItem = renderTab(withStatus(Object.create(Item.prototype)));
		const onCreature = renderTab(withStatus(Object.create(Actor.prototype)));
		config.statusEffects = saved;

		expect(onItem.container.textContent).toContain(word(`${LU}.untilRemoved`));
		expect(onItem.container.textContent).not.toContain(word(`${LU}.none`));
		expect(onCreature.container.textContent).toContain(word(`${LU}.none`));
		expect(onCreature.container.textContent).not.toContain(word(`${LU}.untilRemoved`));
	});

	it('shows an older core duration, which still ends the effect', () => {
		const { container } = renderTab(makeEffect([], { value: 1, units: 'rounds' }));

		const duration = `1 ${word('EFFECT.DURATION.UNITS.rounds')}`;
		expect(container.textContent).toContain(word(`${LU}.coreDuration`, { duration }));
		expect(container.textContent).not.toContain(word(`${LU}.none`));
	});

	it('names each moment row for a screen reader', () => {
		const { container } = renderTab(makeEffect([newMoment('turn'), newMoment('time')]));

		const rows = container.querySelectorAll('.nimble-lasts-until__row[role="group"]');
		const groups = [...rows].map((group) => group.getAttribute('aria-label'));
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

	it('the turn list counts up to the 5th next turn', async () => {
		const effect = makeEffect([newMoment('turn')]);
		const { container } = renderTab(effect);

		await fireEvent.change(field(container, 'span'), { target: { value: 'nextTurn:2' } });

		expect(saved(effect)).toEqual([{ ...newMoment('turn'), value: 2 }]);
	});

	it('"take damage" turns a damage type on', async () => {
		const nimble = CONFIG.NIMBLE as { damageTypes?: unknown };
		const before = nimble.damageTypes;
		nimble.damageTypes = { fire: 'Fire', radiant: 'Radiant' };
		const takeDamage = { ...newMoment('event'), event: 'takeDamage' as const };
		const effect = makeEffect([takeDamage]);
		const { getByRole } = renderTab(effect);

		await fireEvent.click(getByRole('button', { name: 'Fire' }));

		expect(saved(effect)).toEqual([{ ...takeDamage, damageTypes: ['fire'] }]);
		nimble.damageTypes = before;
	});

	it('"gain" picks a condition, or shows a name field for an effect', async () => {
		const config = CONFIG as { statusEffects?: unknown };
		const before = config.statusEffects;
		config.statusEffects = [{ id: 'incapacitated', name: 'Incapacitated' }];
		const gain = { ...newMoment('event'), event: 'gain' as const };
		const effect = makeEffect([gain]);
		const { container } = renderTab(effect);
		const pick = container.querySelector(
			`[aria-label="${word(`${LU}.gainLabel`)}"]`,
		) as HTMLSelectElement;

		await fireEvent.change(pick, { target: { value: 'incapacitated' } });
		expect(saved(effect)).toEqual([{ ...gain, effectName: 'incapacitated' }]);

		await fireEvent.change(pick, { target: { value: '__named' } });
		expect(field(container, 'effectName')).not.toBeNull();
		config.statusEffects = before;
	});

	it('an "an effect named..." pick moves up with its row when a row above is removed', async () => {
		const gain = { ...newMoment('event'), event: 'gain' as const };
		const effect = makeEffect([newMoment('turn'), gain]);
		const { container } = renderTab(effect);
		const pick = container.querySelector(
			`[aria-label="${word(`${LU}.gainLabel`)}"]`,
		) as HTMLSelectElement;
		await fireEvent.change(pick, { target: { value: '__named' } });

		const [first] = container.querySelectorAll(
			`[aria-label^="${word(`${LU}.remove`, { number: '1' }).slice(0, -1)}"]`,
		);
		await fireEvent.click(first);

		expect(saved(effect)).toEqual([gain]);
		expect(field(container, 'effectName')).not.toBeNull();
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

	it('saves the Escape DC', async () => {
		const effect = makeEffect([]);
		const { container } = renderTab(effect);

		const dc = container.querySelector(
			`[aria-label="${word('NIMBLE.effectSheet.escape.dcLabel')}"]`,
		) as HTMLInputElement;
		await fireEvent.change(dc, { target: { value: ' 10 + @intelligence ' } });

		expect(effect.update).toHaveBeenCalledWith({ 'system.escape.dc': '10 + @intelligence' });
	});

	function saveButton(container: HTMLElement, save: string) {
		const group = container.querySelector(
			`[aria-label="${word('NIMBLE.effectSheet.escape.savesLabel')}"]`,
		) as HTMLElement;
		const label = word(`NIMBLE.effectSheet.escape.saves.${save}`);
		return [...group.querySelectorAll('button')].find(
			(button) => button.textContent?.trim() === label,
		) as HTMLButtonElement;
	}

	it('shows the saves that are on as pressed', () => {
		const { container } = renderTab(makeEffect([]));

		expect(saveButton(container, 'strength').getAttribute('aria-pressed')).toBe('true');
		expect(saveButton(container, 'dexterity').getAttribute('aria-pressed')).toBe('true');
		expect(saveButton(container, 'will').getAttribute('aria-pressed')).toBe('false');
	});

	it('turns a save on in the order of the saves, and turns a save off', async () => {
		const effect = makeEffect([]);
		const { container } = renderTab(effect);

		await fireEvent.click(saveButton(container, 'intelligence'));
		expect(effect.update).toHaveBeenLastCalledWith({
			'system.escape.saves': ['strength', 'dexterity', 'intelligence'],
		});

		await fireEvent.click(saveButton(container, 'strength'));
		expect(effect.update).toHaveBeenLastCalledWith({ 'system.escape.saves': ['dexterity'] });
	});

	it('keeps the last save that is on', async () => {
		const effect = makeEffect([]);
		effect.system = { ...effect.system, escape: { dc: '10', saves: ['will'] } };
		const { container } = renderTab(effect);

		await fireEvent.click(saveButton(container, 'will'));

		expect(effect.update).not.toHaveBeenCalled();
	});
});
