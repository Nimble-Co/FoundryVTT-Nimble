import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';

const { undoEndedEffect } = vi.hoisted(() => ({
	undoEndedEffect: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/lastsUntil/endEffects.js', () => ({ undoEndedEffect }));

const { default: CardEvents } = await import('../CardEvents.svelte');

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const row = (holderUuid: string, holderName: string) => ({
	effectId: 'despair',
	holderUuid,
	holderName,
	name: 'Despair',
	img: 'icons/despair.svg',
	sourceName: 'Cultist',
	effect: {},
});

const ended = (id: string, holderUuid: string, holderName: string, at = 1): CardEvent => ({
	id,
	kind: 'effectEnded',
	img: 'icons/despair.svg',
	text: { key: 'NIMBLE.lastsUntil.chat.ended', data: { effect: 'Despair', name: holderName } },
	cause: { key: 'NIMBLE.chat.events.cause.source', data: { source: 'Cultist' } },
	action: { kind: 'undoEnd', row: row(holderUuid, holderName) },
	at,
});

const note = (id: string, at: number): CardEvent => ({
	id,
	kind: 'note',
	icon: 'fa-solid fa-dice-d6',
	text: { key: 'NIMBLE.lastsUntil.chat.heading.rest', data: { name: `Tessa ${id}` } },
	at,
});

/** A card that re-renders on update, as `NimbleChatMessage#reactive` does. */
function makeCard(events: CardEvent[]) {
	let notify: () => void = () => undefined;
	const subscribe = createSubscriber((update) => {
		notify = update;
		return () => undefined;
	});
	const card = {
		id: 'card',
		type: 'feature',
		flags: { [SYSTEM_ID]: { events } } as Record<string, { events: CardEvent[] }>,
		system: {},
		get reactive() {
			subscribe();
			return card;
		},
		/** What an update from the GM does on this client. */
		updated(next: CardEvent[]) {
			card.flags = { [SYSTEM_ID]: { events: next } };
			notify();
		},
	};
	return card;
}

let previous: Record<string, unknown>;
let holders: Record<string, { isOwner: boolean; effects: Map<string, object> }>;

beforeEach(() => {
	vi.clearAllMocks();
	previous = { fromUuidSync: globals.fromUuidSync, user: globals.game.user };
	holders = {
		'Actor.tessa': { isOwner: true, effects: new Map() },
		'Actor.goblin': { isOwner: false, effects: new Map() },
	};
	globals.fromUuidSync = vi.fn((uuid: string) => holders[uuid] ?? null);
	globals.game.user = { isGM: true };
});

afterEach(() => {
	globals.fromUuidSync = previous.fromUuidSync;
	globals.game.user = previous.user;
});

const renderEvents = (card: ReturnType<typeof makeCard>) =>
	render(CardEvents, { props: { messageDocument: card as never } });

describe('CardEvents', () => {
	it('shows nothing when the card has no events', () => {
		const { container } = renderEvents(makeCard([]));

		expect(container.querySelector('section')).toBeNull();
	});

	it('shows the label and a line for each event, in order, with its cause', () => {
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa', 1), note('n1', 2)]));

		const strip = screen.getByRole('region', { name: 'Events' });
		expect(strip).toHaveTextContent('Events');
		const lines = screen.getAllByRole('listitem');
		expect(lines.map((line) => line.dataset.eventKind)).toEqual(['effectEnded', 'note']);
		expect(lines[0]).toHaveTextContent('Despair ended on Tessa');
		expect(lines[0]).toHaveTextContent('Cultist');
		expect(lines[1]).toHaveTextContent('Tessa n1 rested');
		expect(lines[1].querySelector('i.fa-dice-d6')).not.toBeNull();
	});

	it('a line added later shows without a reload', async () => {
		const card = makeCard([note('n1', 1)]);
		renderEvents(card);

		card.updated([note('n1', 1), note('n2', 2)]);
		await tick();

		expect(screen.getAllByRole('listitem')).toHaveLength(2);
		expect(screen.getByText('Tessa n2 rested')).toBeInTheDocument();
	});

	it('a GM can undo every ended effect', () => {
		renderEvents(
			makeCard([ended('e1', 'Actor.tessa', 'Tessa'), ended('e2', 'Actor.goblin', 'Goblin')]),
		);

		expect(screen.getAllByRole('button', { name: /^Undo/ })).toHaveLength(2);
	});

	it('a player can undo only on a creature they own', () => {
		globals.game.user = { isGM: false };

		renderEvents(
			makeCard([ended('e1', 'Actor.tessa', 'Tessa'), ended('e2', 'Actor.goblin', 'Goblin')]),
		);

		expect(screen.getAllByRole('button', { name: /^Undo/ })).toHaveLength(1);
		expect(
			screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' }),
		).toBeInTheDocument();
	});

	it('Undo puts that effect back', async () => {
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));

		await fireEvent.click(screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' }));

		expect(undoEndedEffect).toHaveBeenCalledWith(row('Actor.tessa', 'Tessa'));
	});

	it('an effect that is back on its creature shows where, with no Undo', () => {
		holders['Actor.tessa'].effects.set('despair', {});

		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));

		expect(screen.getByRole('status')).toHaveTextContent('On Tessa');
		expect(screen.queryByRole('button')).toBeNull();
	});
});
