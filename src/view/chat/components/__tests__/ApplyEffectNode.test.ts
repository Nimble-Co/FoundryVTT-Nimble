import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';
import { applyEffectSource } from '#utils/chat/applyEffectFromCard.js';
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
		expect(view.appliedLines).toEqual(['On Goblin']);
	});

	it('names the stacks of a holder that has more than one', () => {
		const view = row({
			applied: [
				{ effectUuid: 'x', actorName: 'Goblin', stacks: 3 },
				{ effectUuid: 'y', actorName: 'Kobold', stacks: 1 },
			],
		});

		expect(view.appliedLines).toEqual(['On Goblin (3 stacks), Kobold']);
	});

	it('says that the effect stays on a holder that kept the one it had', () => {
		const view = row({
			applied: [
				{ effectUuid: 'x', actorName: 'Goblin' },
				{ effectUuid: 'y', actorName: 'Kobold', stays: true },
			],
		});

		expect(view.button).toBeNull();
		expect(view.appliedLines).toEqual(['On Goblin', 'Taunted stays on Kobold']);
		expect(
			row({ applied: [{ effectUuid: 'y', actorName: 'Hero', stays: true }] }).appliedLines,
		).toEqual(['Taunted stays on Hero']);
	});

	it('has no button for a user who did not roll the card, and a disabled one with no targets', () => {
		expect(row({ canApply: false }).button).toBeNull();
		expect(row({ hasRecipient: false }).button).toMatchObject({ disabled: true });
	});

	it('reads the attack that uses up a Held Roll before the moments', () => {
		const usedUp = { by: 'holderAttacks', melee: false, fromSource: false } as const;
		const source = { ...tauntedSource, usedUp };

		expect(row({ source }).lasts).toBe('Until their next attack, or until you drop to 0 HP');
		expect(row({ source, node: { recipient: 'self' } }).lasts).toBe(
			'Until your next attack, or until you drop to 0 HP',
		);
	});

	it('says so when the item no longer has the effect', () => {
		expect(row({ source: null })).toMatchObject({
			button: null,
			note: localize('NIMBLE.chat.applyEffect.missing'),
		});
	});
});

describe('applyEffectSource', () => {
	const heldRoll = { type: 'heldRoll', whichRoll: 'attacksOnHolder', usedUp: true };

	function cardWith(system: Record<string, unknown>) {
		const effect = { name: 'Opening', img: 'opening.svg', system, toObject: () => ({}) };
		const item = { uuid: 'Item.spell', effects: { get: () => effect } };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => item),
		);
		return { flags: { nimble: { itemUuid: item.uuid } }, update: vi.fn() };
	}

	const node = { effectId: 'fx' } as Parameters<typeof applyEffectSource>[1];

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('gives the attack that uses up the Held Roll rule of the item effect', () => {
		const card = cardWith({ lastsUntil: [], rules: [heldRoll] });

		expect(applyEffectSource(card, node)?.usedUp).toEqual({
			by: 'attacksOnHolder',
			melee: false,
			fromSource: false,
		});
	});

	it('gives no used-up attack for an item effect with no Held Roll rule', () => {
		const card = cardWith({ lastsUntil: [zeroHp] });

		expect(applyEffectSource(card, node)?.usedUp).toBeNull();
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
	let previousActiveEffect: unknown;

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
		previousActiveEffect = (CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect;
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create: createEffect, deleteDocuments: vi.fn() },
		};
	});

	afterEach(() => {
		(globalThis as unknown as { game: { user: unknown } }).game.user = previousUser;
		(CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect = previousActiveEffect;
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
			{ parent: goblin, [SYSTEM_ID]: { effectCardId: 'message-1' } },
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

describe('the temp healing that an effect gives', () => {
	const healing = {
		id: 'h1',
		type: 'healing',
		healingType: 'tempHealing',
		formula: '2*@key',
		roll: { total: 6 },
		parentNode: null,
		parentContext: null,
	};
	const apply = {
		id: 'a1',
		type: 'applyEffect',
		effectId: 'fx',
		recipient: 'self',
		tempHealingNodeId: 'h1',
	};
	const card = {
		system: { activation: { effects: [healing, apply] } },
		update: async () => undefined,
	};

	it('reads the roll of the linked temp healing node', async () => {
		const { givenByAnEffect, linkedTempHealing } = await import(
			'#utils/chat/applyEffectFromCard.js'
		);

		expect(linkedTempHealing(card, apply as never)).toEqual({ id: 'h1', total: 6 });
		expect(linkedTempHealing(card, { tempHealingNodeId: null })).toBeNull();
		expect(givenByAnEffect(card, 'h1')).toBe(true);
		expect(givenByAnEffect(card, 'other')).toBe(false);
	});
});
