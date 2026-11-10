import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import localize from '#utils/localize.js';
import { applyEffectRow } from '../applyEffectRow.js';
import ItemCardEffectsTestHarness from './ItemCardEffects.testHarness.svelte';

const zeroHp = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'source',
	event: 'zeroHp',
	effectName: '',
} as const;

const tauntedSource = { name: 'Taunted', img: 'taunted.svg', lastsUntil: [zeroHp], escape: false };

function row(fields: Partial<Parameters<typeof applyEffectRow>[0]> = {}) {
	return applyEffectRow({
		node: { recipient: 'targets' },
		source: tauntedSource,
		applied: undefined,
		canApply: true,
		hasRecipient: true,
		localize,
		format: localize,
		...fields,
	});
}

describe('applyEffectRow', () => {
	it('names the recipient on the button and reads the Lasts Until for the card', () => {
		expect(row()).toMatchObject({
			name: 'Taunted',
			lasts: 'Until you drop to 0 HP',
			button: { label: 'Apply to Targets', disabled: false },
		});
		expect(row({ node: { recipient: 'self' } }).button?.label).toBe('Apply to You');
	});

	it('shows who took it in place of the button', () => {
		const view = row({ applied: [{ effectUuid: 'x', actorName: 'Goblin' }] });
		expect(view.button).toBeNull();
		expect(view.appliedLine).toBe('On Goblin');
	});

	it('has no button for a user who did not roll the card, and a disabled one with no targets', () => {
		expect(row({ canApply: false }).button).toBeNull();
		expect(row({ hasRecipient: false }).button).toMatchObject({ disabled: true });
	});

	it('says so when the item no longer has the effect', () => {
		expect(row({ source: null })).toMatchObject({
			button: null,
			note: localize('NIMBLE.chat.applyEffect.missing'),
		});
	});
});

describe('ApplyEffectNode on the card', () => {
	const createEffect = vi.fn();
	const goblin = { uuid: 'Actor.goblin', name: 'Goblin', isOwner: true, effects: [] };
	const itemEffect = {
		name: 'Snowblind',
		img: 'snow.svg',
		system: { lastsUntil: [zeroHp], escape: { dc: '' } },
		toObject: () => ({
			_id: 'fx',
			name: 'Snowblind',
			statuses: [],
			system: { lastsUntil: [zeroHp] },
		}),
	};
	const item = {
		uuid: 'Actor.hero.Item.spell',
		actor: { uuid: 'Actor.hero', type: 'character', getRollData: () => ({}) },
		effects: { get: (id: string) => (id === 'fx' ? itemEffect : undefined) },
	};
	const node = {
		id: 'node1',
		type: 'applyEffect',
		effectId: 'fx',
		recipient: 'targets',
		parentNode: null,
		parentContext: null,
	};

	function message(applied?: unknown) {
		const card = {
			id: 'message-1',
			author: { id: 'player' },
			flags: { nimble: { itemUuid: item.uuid, ...(applied ? { appliedEffects: applied } : {}) } },
			effectNodes: [[node]],
			system: { targets: ['Scene.s.Token.goblin'], activation: { effects: [node] } },
			update: vi.fn(async () => undefined),
			reactive: null as unknown,
		};
		card.reactive = card;
		return card;
	}

	let previousUser: unknown;

	beforeEach(() => {
		const g = globalThis as unknown as { game: { user: unknown } };
		previousUser = g.game.user;
		g.game.user = { id: 'player', isGM: false };
		createEffect.mockReset().mockResolvedValue({ uuid: 'Actor.goblin.ActiveEffect.new' });
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === item.uuid ? item : uuid === 'Scene.s.Token.goblin' ? { actor: goblin } : null,
			),
		);
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => ({ uuid })),
		);
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create: createEffect, deleteDocuments: vi.fn() },
		};
	});

	afterEach(() => {
		(globalThis as unknown as { game: { user: unknown } }).game.user = previousUser;
		vi.unstubAllGlobals();
	});

	it('puts the effect on the target with a click and records who took it', async () => {
		const card = message();
		render(ItemCardEffectsTestHarness, { props: { messageDocument: card } });

		expect(screen.getByRole('heading', { name: 'Effects' })).toBeTruthy();
		expect(screen.getByText('Until you drop to 0 HP')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /Apply to Targets/ }));

		await waitFor(() =>
			expect(card.update).toHaveBeenCalledWith({
				'flags.nimble.appliedEffects.node1': [
					{ effectUuid: 'Actor.goblin.ActiveEffect.new', actorName: 'Goblin' },
				],
			}),
		);
		expect(createEffect).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Snowblind', origin: item.uuid }),
			{ parent: goblin },
		);
	});

	it('shows the after-click state from the card flags', () => {
		render(ItemCardEffectsTestHarness, {
			props: {
				messageDocument: message({ node1: [{ effectUuid: 'x', actorName: 'Goblin' }] }),
			},
		});

		expect(screen.getByText('On Goblin')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Apply to Targets/ })).toBeNull();
	});
});
