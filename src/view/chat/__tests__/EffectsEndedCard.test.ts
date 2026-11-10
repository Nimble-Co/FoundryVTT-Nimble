import { fireEvent, render, screen } from '@testing-library/svelte';

const { undoEndedEffect } = vi.hoisted(() => ({ undoEndedEffect: vi.fn(async () => true) }));

vi.mock('#utils/lastsUntil/endEffects.js', () => ({ undoEndedEffect }));

const { default: EffectsEndedCard } = await import('../EffectsEndedCard.svelte');

type Globals = Record<string, any>;
const g = globalThis as Globals;

const TEXT: Record<string, string> = {
	'NIMBLE.lastsUntil.chat.ended': '{effect} ended on {name}',
	'NIMBLE.lastsUntil.chat.undo': 'Undo',
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
			],
		},
		reactive: null as unknown,
		delete: vi.fn(),
	};
	message.reactive = message;
	return render(EffectsEndedCard, { props: { messageDocument: message as never } });
}

let previous: Record<string, unknown>;
let owned: Record<string, boolean>;

beforeEach(() => {
	vi.clearAllMocks();
	const localize = g.game.i18n.localize.bind(g.game.i18n);
	vi.spyOn(g.game.i18n, 'localize').mockImplementation((key: unknown) =>
		typeof key === 'string' && key in TEXT ? TEXT[key] : localize(key),
	);
	previous = {
		fromUuidSync: g.fromUuidSync,
		user: g.game.user,
		timeSince: g.foundry.utils.timeSince,
	};
	owned = { 'Actor.goblin': false, 'Actor.tessa': true };
	g.fromUuidSync = vi.fn((uuid: string) => ({ isOwner: owned[uuid] ?? false }));
	g.game.user = { isGM: true };
	g.foundry.utils.timeSince = () => 'now';
});

afterEach(() => {
	g.fromUuidSync = previous.fromUuidSync;
	g.game.user = previous.user;
	g.foundry.utils.timeSince = previous.timeSince;
	vi.restoreAllMocks();
});

const undoButtons = () => screen.queryAllByRole('button', { name: 'Undo' });

describe('EffectsEndedCard', () => {
	it('names the moment and has one row for each effect that ended', () => {
		renderCard();

		expect(screen.getByText("Start of Tessa's turn")).toBeTruthy();
		expect(screen.getByText('Blinded ended on Goblin')).toBeTruthy();
		expect(screen.getByText('Invisible ended on Tessa')).toBeTruthy();
		expect(undoButtons()).toHaveLength(2);
	});

	it('a player sees Undo only on the rows of a creature they own', () => {
		g.game.user = { isGM: false };

		renderCard();

		expect(undoButtons()).toHaveLength(1);
	});

	it('Undo puts that one effect back and says where it is', async () => {
		renderCard();

		await fireEvent.click(undoButtons()[0]);

		expect(undoEndedEffect).toHaveBeenCalledTimes(1);
		expect(undoEndedEffect).toHaveBeenCalledWith(expect.objectContaining({ effectId: 'a' }));
		expect(await screen.findByText('On Goblin')).toBeTruthy();
		expect(undoButtons()).toHaveLength(1);
	});
});
