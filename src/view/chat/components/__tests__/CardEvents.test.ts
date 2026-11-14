import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';
// @ts-expect-error - Svelte component default export is provided by the Svelte compiler
import CardEvents from '../CardEvents.svelte';

const { undoEndedEffect } = vi.hoisted(() => ({
	undoEndedEffect: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/lastsUntil/endEffects.js', () => ({ undoEndedEffect }));

const { rollRequestedSave } = vi.hoisted(() => ({
	rollRequestedSave: vi.fn(async (..._args: unknown[]) => true),
}));

const { chooseTempHp } = vi.hoisted(() => ({
	chooseTempHp: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/actor/tempHpChoice.js', () => ({
	chooseTempHp,
	canChooseTempHp: (action: { holderUuid: string }) =>
		!!(globalThis as Globals).game.user?.isGM ||
		!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner,
}));

vi.mock('#utils/saveRequest/saveRequests.js', () => ({
	rollRequestedSave,
	canRollRequest: (action: { holderUuid: string; saveMessageId?: string }) =>
		!action.saveMessageId &&
		(!!(globalThis as Globals).game.user?.isGM ||
			!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner),
}));

const { takeTurnDamage, undoTurnDamage } = vi.hoisted(() => ({
	takeTurnDamage: vi.fn(async (..._args: unknown[]) => true),
	undoTurnDamage: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/damage/turnDamageLine.js', () => ({
	takeTurnDamage,
	undoTurnDamage,
	canActOnTurnDamage: (action: { holderUuid: string }) =>
		!!(globalThis as Globals).game.user?.isGM ||
		!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner,
}));

const { actOnStackGain } = vi.hoisted(() => ({
	actOnStackGain: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/actor/stackGainLine.js', () => ({
	actOnStackGain,
	canActOnStackGain: (action: { holderUuid: string }) =>
		!!(globalThis as Globals).game.user?.isGM ||
		!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner,
}));

const { actOnZeroHp } = vi.hoisted(() => ({
	actOnZeroHp: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/lastsUntil/zeroHpAtEnd.js', () => ({
	actOnZeroHp,
	canActOnZeroHp: (action: { holderUuid: string }) =>
		!!(globalThis as Globals).game.user?.isGM ||
		!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner,
}));

const { endEscape } = vi.hoisted(() => ({
	endEscape: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/lastsUntil/escapeFollow.js', () => ({
	endEscape,
	canRuleEscape: (action: { holderUuid: string }) =>
		!!(globalThis as Globals).game.user?.isGM ||
		!!(globalThis as Globals).fromUuidSync(action.holderUuid)?.isOwner,
}));

const { endWaiting, emptyPoolFromLine, settleCritDiceLine } = vi.hoisted(() => ({
	endWaiting: vi.fn(async (..._args: unknown[]) => true),
	emptyPoolFromLine: vi.fn(async (..._args: unknown[]) => true),
	settleCritDiceLine: vi.fn(async (..._args: unknown[]) => true),
}));

const ownerOrGm = (uuid: string) =>
	!!(globalThis as Globals).game.user?.isGM ||
	!!(globalThis as Globals).fromUuidSync(uuid)?.isOwner;

vi.mock('#utils/lastsUntil/endWaiting.js', () => ({
	endWaiting,
	canEndWaiting: (action: { holderUuid: string }) => ownerOrGm(action.holderUuid),
}));

vi.mock('#utils/dicePool/emptyPoolLine.js', () => ({
	emptyPoolFromLine,
	canEmptyPool: (action: { holderUuid: string }) => ownerOrGm(action.holderUuid),
}));

vi.mock('#utils/rolls/critDiceSaveLine.js', () => ({
	settleCritDiceLine,
	canSettleCritDiceLine: (action: { actorUuid: string }) => ownerOrGm(action.actorUuid),
}));

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

const saveLine = (state: 'waiting' | 'kept'): CardEvent => ({
	id: 'save1',
	kind: 'saveRequest',
	img: 'icons/concentration.svg',
	text: { key: 'NIMBLE.chat.saveRequest.ask', data: { name: 'Tessa', effect: 'Concentration' } },
	action: {
		kind: 'saveRequest',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		effectId: 'eConc',
		effectName: 'Concentration',
		save: 'strength',
		dc: 10,
		state,
	},
	at: 1,
});

const escapeLine = (state: 'waiting' | 'failed'): CardEvent => ({
	id: 'escape1',
	kind: 'escape',
	icon: 'fa-solid fa-person-running',
	text: {
		key: state === 'waiting' ? 'NIMBLE.escape.chat.tries' : 'NIMBLE.escape.chat.failed',
		data: { name: 'Tessa', effect: 'Grappled' },
	},
	action: {
		kind: 'escapeRuling',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		effectId: 'grab',
		effectName: 'Grappled',
		state,
	},
	at: 1,
});

const poolLine = (id: string, at: number): CardEvent => ({
	id,
	kind: 'poolGain',
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
	previous = { user: globals.game.user };
	holders = {
		'Actor.tessa': { isOwner: true, effects: new Map() },
		'Actor.goblin': { isOwner: false, effects: new Map() },
	};
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => holders[uuid] ?? null),
	);
	globals.game.user = { isGM: true };
});

afterEach(() => {
	vi.unstubAllGlobals();
	globals.game.user = previous.user;
});

const renderEvents = (card: ReturnType<typeof makeCard>, labelled?: boolean) =>
	render(CardEvents, { props: { messageDocument: card as never, labelled } });

/** What Foundry does on every client when an effect is made. */
function effectCreated() {
	const calls = vi.mocked(Hooks.on).mock.calls as unknown as [string, () => void][];
	for (const [hook, callback] of calls) if (hook === 'createActiveEffect') callback();
}

describe('CardEvents', () => {
	it('shows nothing when the card has no events', () => {
		const { container } = renderEvents(makeCard([]));

		expect(container.querySelector('section')).toBeNull();
	});

	it('shows the label and a line for each event, in order, with its cause', () => {
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa', 1), poolLine('n1', 2)]));

		const strip = screen.getByRole('region', { name: 'Events' });
		const heading = screen.getByRole('heading', { name: 'Events' });
		expect(strip).toHaveAttribute('aria-labelledby', heading.id);
		expect(strip).not.toHaveAttribute('aria-label');
		const lines = screen.getAllByRole('listitem');
		expect(lines.map((line) => line.dataset.eventKind)).toEqual(['effectEnded', 'poolGain']);
		expect(lines[0]).toHaveTextContent('Despair ended on Tessa');
		expect(lines[0]).toHaveTextContent('Cultist');
		expect(lines[1]).toHaveTextContent('Tessa n1 rested');
		expect(lines[1].querySelector('i.fa-dice-d6')).not.toBeNull();
	});

	it('a save line has a Roll button for the owner of the creature and the GM', async () => {
		renderEvents(makeCard([saveLine('waiting')]));

		const roll = screen.getByRole('button', { name: /Roll the STR save of Tessa/ });
		await fireEvent.click(roll);

		expect(rollRequestedSave).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'save1' }),
		);
	});

	it('a line whose save card is rolled has no second Roll', () => {
		const rolled = saveLine('waiting');
		(rolled.action as { saveMessageId?: string }).saveMessageId = 's1';
		renderEvents(makeCard([rolled]));

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Waiting for Tessa')).toBeInTheDocument();
	});

	it('other players see who the save waits for, and then that it was kept', () => {
		globals.game.user = { isGM: false };
		holders['Actor.tessa'].isOwner = false;
		const { unmount } = renderEvents(makeCard([saveLine('waiting')]));

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Waiting for Tessa')).toBeInTheDocument();
		expect(screen.queryByRole('status')).toBeNull();
		unmount();

		renderEvents(makeCard([saveLine('kept')]));
		expect(screen.getByRole('status')).toHaveTextContent('Kept');
	});

	it('an Escape with no DC has Escapes for the owner of the creature and the GM', async () => {
		renderEvents(makeCard([escapeLine('waiting')]));

		await fireEvent.click(screen.getByRole('button', { name: 'Tessa escapes Grappled' }));

		expect(screen.getByRole('button', { name: 'Tessa escapes Grappled' })).toHaveTextContent(
			'Escapes',
		);
		expect(endEscape).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'escape1' }),
		);
	});

	it('other players see that the Escape waits for the GM, and a failed one has no button', () => {
		globals.game.user = { isGM: false };
		holders['Actor.tessa'].isOwner = false;
		const { unmount } = renderEvents(makeCard([escapeLine('waiting')]));

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Waiting for the GM')).toBeInTheDocument();
		unmount();

		globals.game.user = { isGM: true };
		renderEvents(makeCard([escapeLine('failed')]));
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Tessa fails to escape Grappled')).toBeInTheDocument();
	});

	it('a temp HP choice has Keep and Take for the owner, and nothing to click once made', async () => {
		const choice = (state: 'waiting' | 'kept'): CardEvent => ({
			id: 'temp1',
			kind: 'tempHpChoice',
			icon: 'fa-solid fa-shield-halved',
			text: { key: 'NIMBLE.chat.tempHpChoice.ask', data: { name: 'Tessa', had: 5, amount: 3 } },
			action: {
				kind: 'tempHpChoice',
				holderUuid: 'Actor.tessa',
				holderName: 'Tessa',
				had: 5,
				amount: 3,
				effectUuid: null,
				state,
			},
			at: 1,
		});
		const { unmount } = renderEvents(makeCard([choice('waiting')]));

		expect(screen.getByRole('button', { name: /keeps the 5 temp HP/ })).toHaveTextContent('Keep 5');
		await fireEvent.click(screen.getByRole('button', { name: /takes 3 temp HP/ }));
		expect(chooseTempHp).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'temp1' }),
			true,
		);
		unmount();

		renderEvents(makeCard([choice('kept')]));
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('a turn damage line has Take Damage while it waits, Undo once dealt, and a badge once undone', async () => {
		const damage = (
			state: 'waiting' | 'dealt' | 'undone',
			holderUuid = 'Actor.tessa',
		): CardEvent => ({
			id: 'turnDamage1',
			kind: 'damage',
			icon: 'fa-solid fa-fire-flame-curved',
			text: {
				key: 'NIMBLE.chat.turnDamage.takes',
				data: {
					name: 'Tessa',
					damage: { key: 'NIMBLE.chat.turnDamage.plain', data: { amount: 7 } },
				},
			},
			action: {
				kind: 'turnDamage',
				holderUuid,
				holderName: 'Tessa',
				amount: 7,
				damageType: '',
				wounds: 0,
				sourceUuid: null,
				state,
			},
			at: 1,
		});
		globals.game.user = { isGM: false };

		const waiting = renderEvents(makeCard([damage('waiting')]));
		expect(screen.getByText('Tessa takes 7 damage')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /Tessa takes the damage/ }));
		expect(takeTurnDamage).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'turnDamage1' }),
		);
		waiting.unmount();

		const dealt = renderEvents(makeCard([damage('dealt')]));
		await fireEvent.click(screen.getByRole('button', { name: /give back to Tessa/ }));
		expect(undoTurnDamage).toHaveBeenCalled();
		dealt.unmount();

		const other = renderEvents(makeCard([damage('dealt', 'Actor.goblin')]));
		expect(screen.queryByRole('button')).toBeNull();
		other.unmount();

		renderEvents(makeCard([damage('undone')]));
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByRole('status')).toHaveTextContent('Undone');
	});

	it('a waiting end has End for the owner of the holder, and no button once it is gone', async () => {
		const waitingEnd = (
			state: 'waiting' | 'ending' | 'gone',
			holderUuid = 'Actor.tessa',
		): CardEvent => ({
			id: 'wait1',
			kind: 'waitingEnd',
			icon: 'fa-solid fa-hourglass-half',
			text: {
				key: state === 'gone' ? 'NIMBLE.lastsUntil.chat.notOn' : 'NIMBLE.lastsUntil.chat.endsOn',
				data: { effect: 'Blinded', name: 'Tessa' },
			},
			action: {
				kind: 'waitingEnd',
				holderUuid,
				holderName: 'Tessa',
				effectId: 'blind',
				effectName: 'Blinded',
				state,
				end: { heading: { key: 'x' } },
			},
			at: 1,
		});
		globals.game.user = { isGM: false };

		const waiting = renderEvents(makeCard([waitingEnd('waiting')]));
		expect(screen.getByText('Blinded ends on Tessa')).toBeInTheDocument();
		const end = screen.getByRole('button', { name: 'End Blinded on Tessa' });
		expect(end).toHaveTextContent('End');
		await fireEvent.click(end);
		expect(endWaiting).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'wait1' }),
		);
		waiting.unmount();

		const other = renderEvents(makeCard([waitingEnd('waiting', 'Actor.goblin')]));
		expect(screen.queryByRole('button')).toBeNull();
		other.unmount();

		const ending = renderEvents(makeCard([waitingEnd('ending')]));
		expect(screen.queryByRole('button')).toBeNull();
		ending.unmount();

		renderEvents(makeCard([waitingEnd('gone')]));
		expect(screen.getByText('Blinded is no longer on Tessa')).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('a pool line has Empty while it waits, and no button once emptied', async () => {
		const poolWaits = (state: 'waiting' | 'emptied'): CardEvent => ({
			id: 'pool1',
			kind: 'emptyPool',
			icon: 'fa-solid fa-dice',
			text: { key: 'NIMBLE.chat.emptyPool.text', data: { pool: 'Fury Dice' } },
			action: {
				kind: 'emptyPool',
				holderUuid: 'Actor.tessa',
				holderName: 'Tessa',
				poolId: 'fury',
				poolLabel: 'Fury Dice',
				state,
			},
			at: 1,
		});

		const waiting = renderEvents(makeCard([poolWaits('waiting')]));
		await fireEvent.click(screen.getByRole('button', { name: 'Empty Fury Dice of Tessa' }));
		expect(emptyPoolFromLine).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'pool1' }),
		);
		waiting.unmount();

		renderEvents(makeCard([poolWaits('emptied')]));
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('a crit dice save line has Apply while it waits, and no button once done', async () => {
		const critLine = (state: 'waiting' | 'done'): CardEvent => ({
			id: 'crit1',
			kind: 'critDiceSave',
			icon: 'fa-solid fa-dice-d20',
			text: { key: 'NIMBLE.chat.critDiceSave.max', data: { name: 'Tessa' } },
			action: {
				kind: 'critDiceSave',
				actorUuid: 'Actor.tessa',
				actorName: 'Tessa',
				saveMessageId: 'save',
				outcome: 'fail',
				state,
			},
			at: 1,
		});

		const waiting = renderEvents(makeCard([critLine('waiting')]));
		const apply = screen.getByRole('button', { name: 'Set the dice to their max' });
		expect(apply).toHaveTextContent('Apply');
		await fireEvent.click(apply);
		expect(settleCritDiceLine).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'crit1' }),
		);
		waiting.unmount();

		renderEvents(makeCard([critLine('done')]));
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('a stack line has Apply while it waits, Undo once gained, and a badge once undone', async () => {
		const stackLine = (
			state: 'waiting' | 'gained' | 'undone',
			holderUuid = 'Actor.tessa',
		): CardEvent => ({
			id: 'stack1',
			kind: 'stackGain',
			icon: 'fa-solid fa-layer-group',
			text: {
				key: state === 'waiting' ? 'NIMBLE.chat.stackGain.has' : 'NIMBLE.chat.stackGain.gains',
				data: { name: 'Tessa', count: 3, stacked: 'Dazed', effect: 'Petrified' },
			},
			action: {
				kind: 'stackGain',
				holderUuid,
				holderName: 'Tessa',
				count: 3,
				stackedName: 'Dazed',
				gainedName: 'Petrified',
				state,
			},
			at: 1,
		});
		globals.game.user = { isGM: false };

		const waiting = renderEvents(makeCard([stackLine('waiting')]));
		expect(screen.getByText('Tessa has 3 stacks of Dazed')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Apply Petrified to Tessa' }));
		expect(actOnStackGain).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'stack1' }),
		);
		waiting.unmount();

		const gained = renderEvents(makeCard([stackLine('gained')]));
		expect(screen.getByText('Tessa gains Petrified: 3 stacks of Dazed')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /take Petrified off Tessa/ }));
		expect(actOnStackGain).toHaveBeenCalledTimes(2);
		gained.unmount();

		const other = renderEvents(makeCard([stackLine('gained', 'Actor.goblin')]));
		expect(screen.queryByRole('button')).toBeNull();
		other.unmount();

		renderEvents(makeCard([stackLine('undone')]));
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByRole('status')).toHaveTextContent('Undone');
	});

	it('a 0 HP line has Drop to 0 HP while it waits, Undo once dropped, and a badge once undone', async () => {
		const zeroLine = (
			state: 'waiting' | 'dropped' | 'undone',
			holderUuid = 'Actor.tessa',
		): CardEvent => ({
			id: 'zeroHp1',
			kind: 'healthState',
			icon: 'fa-solid fa-heart-crack',
			text: { key: 'NIMBLE.chat.zeroHpAtEnd.drops', data: { name: 'Tessa' } },
			cause: { key: 'NIMBLE.chat.zeroHpAtEnd.cause', data: { effect: 'Dragonform' } },
			action: {
				kind: 'zeroHp',
				holderUuid,
				holderName: 'Tessa',
				effectName: 'Dragonform',
				state,
			},
			at: 1,
		});
		globals.game.user = { isGM: false };

		const waiting = renderEvents(makeCard([zeroLine('waiting')]));
		expect(screen.getByText('Tessa drops to 0 HP')).toBeInTheDocument();
		const drop = screen.getByRole('button', { name: 'Tessa drops to 0 HP: Dragonform ended' });
		expect(drop).toHaveTextContent('Drop to 0 HP');
		await fireEvent.click(drop);
		expect(actOnZeroHp).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'card' }),
			expect.objectContaining({ id: 'zeroHp1' }),
		);
		waiting.unmount();

		const dropped = renderEvents(makeCard([zeroLine('dropped')]));
		await fireEvent.click(screen.getByRole('button', { name: /give back to Tessa the HP/ }));
		expect(actOnZeroHp).toHaveBeenCalledTimes(2);
		dropped.unmount();

		const other = renderEvents(makeCard([zeroLine('dropped', 'Actor.goblin')]));
		expect(screen.queryByRole('button')).toBeNull();
		other.unmount();

		renderEvents(makeCard([zeroLine('undone')]));
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByRole('status')).toHaveTextContent('Undone');
	});

	it('a strip with no heading names itself', () => {
		renderEvents(makeCard([poolLine('n1', 1)]), false);

		const strip = screen.getByRole('region', { name: 'Events' });
		expect(screen.queryByRole('heading')).toBeNull();
		expect(strip).not.toHaveAttribute('aria-labelledby');
	});

	it('a line added later shows without a reload', async () => {
		const card = makeCard([poolLine('n1', 1)]);
		renderEvents(card);

		card.updated([poolLine('n1', 1), poolLine('n2', 2)]);
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

	it.each([
		['says no', async () => false],
		['fails', async () => Promise.reject(new Error('gone'))],
	])('Undo that %s tells the user', async (_name, result) => {
		undoEndedEffect.mockImplementationOnce(result);
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));

		await fireEvent.click(screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' }));
		await tick();

		expect(ui.notifications?.warn).toHaveBeenCalledWith('Could not put Despair back on Tessa.');
	});

	it('Undo that works tells nothing', async () => {
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));

		await fireEvent.click(screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' }));
		await tick();

		expect(ui.notifications?.warn).not.toHaveBeenCalled();
	});

	it('after Undo, the focus moves to the line that tells where the effect is', async () => {
		undoEndedEffect.mockImplementationOnce(async () => {
			holders['Actor.tessa'].effects.set('despair', {});
			effectCreated();
			return true;
		});
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));
		const button = screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' });
		button.focus();

		await fireEvent.click(button);
		await tick();

		const status = screen.getByRole('status');
		expect(status).toHaveTextContent('On Tessa');
		expect(status).toHaveFocus();
	});

	it('a second click while Undo runs does nothing', async () => {
		let finish: (value: boolean) => void = () => undefined;
		undoEndedEffect.mockImplementationOnce(
			() => new Promise<boolean>((resolve) => (finish = resolve)),
		);
		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));
		const button = screen.getByRole('button', { name: 'Undo: put Despair back on Tessa' });

		await fireEvent.click(button);
		await fireEvent.click(button);

		expect(button).toHaveAttribute('aria-disabled', 'true');
		expect(undoEndedEffect).toHaveBeenCalledTimes(1);
		finish(true);
	});

	it('the cause line keeps its stored words', () => {
		const event = ended('e1', 'Actor.tessa', 'Tessa');
		event.cause = { key: 'an enemy hit you' };
		renderEvents(makeCard([event]));

		expect(screen.getByText('an enemy hit you')).toHaveClass('nimble-card-events__cause');
	});

	it('an effect that is back on its creature shows where, with no Undo', () => {
		holders['Actor.tessa'].effects.set('despair', {});

		renderEvents(makeCard([ended('e1', 'Actor.tessa', 'Tessa')]));

		expect(screen.getByRole('status')).toHaveTextContent('On Tessa');
		expect(screen.queryByRole('button')).toBeNull();
	});
});

describe('CardEvents movement line', () => {
	const offer = {
		id: 'line.hero',
		nodeId: 'line',
		tokenUuid: 'Scene.s.Token.hero',
		name: 'Hero',
		kind: 'free' as const,
		spaces: 6,
		ignoreDifficultTerrain: false,
		state: 'open' as const,
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		conditional: false,
	};
	const moveLine: CardEvent = {
		id: 'movementOffer.line',
		kind: 'movementOffer',
		img: 'icons/charge.svg',
		text: { key: 'NIMBLE.chat.events.movementOffer.text', data: { name: 'Charge' } },
		action: {
			kind: 'movementOffer',
			node: {
				id: 'line',
				type: 'move',
				kind: 'free',
				recipient: 'self',
				distance: '6',
				distanceBySize: {},
				ignoreDifficultTerrain: false,
				direction: 'any',
				parentContext: null,
				parentNode: null,
			},
			offers: [offer],
		},
		at: 1,
	};

	it('shows the move and each creature it is for, from the offers the card stores', () => {
		const card = makeCard([moveLine]) as ReturnType<typeof makeCard> & { system: object };
		card.system = { movementOffers: [offer] };
		render(CardEvents, { props: { messageDocument: card as never } });

		const [line] = screen.getAllByRole('listitem');
		expect(line).toHaveAttribute('data-event-kind', 'movementOffer');
		expect(line.querySelector('.nimble-card-events__text')).toHaveTextContent('Charge');
		const move = line.querySelector('.nimble-card-events__move .nimble-move-node');
		expect(move).not.toBeNull();
		expect(move).toHaveTextContent('Hero');
	});
});
