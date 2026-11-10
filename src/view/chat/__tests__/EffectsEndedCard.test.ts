import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { undoEndedEffect } = vi.hoisted(() => ({
	undoEndedEffect: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock('#utils/lastsUntil/endEffects.js', () => ({ undoEndedEffect }));

const { default: EffectsEndedCard } = await import('../EffectsEndedCard.svelte');

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const TEXT: Record<string, string> = {
	'NIMBLE.lastsUntil.chat.ended': '{effect} ended on {name}',
	'NIMBLE.lastsUntil.chat.undo': 'Undo',
	'NIMBLE.lastsUntil.chat.undoLabel': 'Undo: put {effect} back on {name}',
	'NIMBLE.lastsUntil.chat.backOn': 'On {name}',
};

const row = (effectId: string, holderUuid: string, name: string, holderName: string) => ({
	effectId,
	holderUuid,
	holderName,
	name,
	img: '',
	sourceName: 'Pocket Sand',
	effect: {},
});

function renderCard() {
	const message = {
		id: 'msg1',
		timestamp: 0,
		author: { color: '#336699' },
		system: {
			actorName: 'Gamemaster',
			heading: "Start of Tessa's turn",
			rows: [
				row('a', 'Actor.goblin', 'Blinded', 'Goblin'),
				row('b', 'Actor.tessa', 'Invisible', 'Tessa'),
				row('a', 'Actor.ogre', 'Blinded', 'Ogre'),
			],
		},
		reactive: null as unknown,
		delete: vi.fn(),
	};
	message.reactive = message;
	return render(EffectsEndedCard, { props: { messageDocument: message as never } });
}

interface Holder {
	isOwner: boolean;
	effects: Map<string, object>;
}

let previous: Record<string, unknown>;
let holders: Record<string, Holder>;
let effectHooks: Array<() => void>;

/** What Foundry does when an effect is made on any client: the hook runs. */
function effectMade(holderUuid: string, effectId: string) {
	holders[holderUuid].effects.set(effectId, {});
	for (const hook of effectHooks) hook();
}

beforeEach(() => {
	vi.clearAllMocks();
	const localize = globals.game.i18n.localize.bind(globals.game.i18n);
	vi.spyOn(globals.game.i18n, 'localize').mockImplementation((key: unknown) =>
		typeof key === 'string' && key in TEXT ? TEXT[key] : localize(key),
	);
	previous = {
		fromUuidSync: globals.fromUuidSync,
		user: globals.game.user,
		timeSince: globals.foundry.utils.timeSince,
		hooksOn: globals.Hooks.on,
	};
	holders = {
		'Actor.goblin': { isOwner: false, effects: new Map() },
		'Actor.tessa': { isOwner: true, effects: new Map() },
		'Actor.ogre': { isOwner: false, effects: new Map() },
	};
	effectHooks = [];
	globals.Hooks.on = vi.fn((_hook: string, callback: () => void) => {
		effectHooks.push(callback);
		return effectHooks.length;
	});
	globals.fromUuidSync = vi.fn((uuid: string) => holders[uuid] ?? null);
	globals.game.user = { isGM: true };
	globals.foundry.utils.timeSince = () => 'now';
});

afterEach(() => {
	globals.fromUuidSync = previous.fromUuidSync;
	globals.game.user = previous.user;
	globals.foundry.utils.timeSince = previous.timeSince;
	globals.Hooks.on = previous.hooksOn;
	vi.restoreAllMocks();
});

const undoButtons = () => screen.queryAllByRole('button', { name: /^Undo/ });

describe('EffectsEndedCard', () => {
	it('names the moment and has one row for each effect that ended', () => {
		renderCard();

		expect(screen.getByText("Start of Tessa's turn")).toBeInTheDocument();
		expect(screen.getByText('Blinded ended on Goblin')).toBeInTheDocument();
		expect(screen.getByText('Invisible ended on Tessa')).toBeInTheDocument();
		expect(undoButtons()).toHaveLength(3);
	});

	it('names the effect and the creature on each Undo button', () => {
		renderCard();

		expect(
			screen.getByRole('button', { name: 'Undo: put Blinded back on Goblin' }),
		).toBeInTheDocument();
	});

	it('a player sees Undo only on the rows of a creature they own', () => {
		globals.game.user = { isGM: false };

		renderCard();

		expect(undoButtons()).toHaveLength(1);
	});

	it('Undo asks to put that one effect back', async () => {
		renderCard();

		await fireEvent.click(screen.getByRole('button', { name: 'Undo: put Blinded back on Goblin' }));

		expect(undoEndedEffect).toHaveBeenCalledTimes(1);
		expect(undoEndedEffect).toHaveBeenCalledWith(
			expect.objectContaining({ effectId: 'a', holderUuid: 'Actor.goblin' }),
		);
	});

	it('when the effect is back on its creature, the row says where, for every client', async () => {
		renderCard();

		effectMade('Actor.goblin', 'a');

		expect(await screen.findByText('On Goblin')).toBeInTheDocument();
		expect(screen.getByRole('status')).toHaveTextContent('On Goblin');
		// The Ogre row has the same effect id, on another creature: it keeps its Undo.
		expect(
			screen.getByRole('button', { name: 'Undo: put Blinded back on Ogre' }),
		).toBeInTheDocument();
		expect(undoButtons()).toHaveLength(2);
	});
});
