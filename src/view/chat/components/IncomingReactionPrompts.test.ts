interface SpendDialogMock {
	instances: Array<{ args: unknown[]; rendered: boolean }>;
	/** What the picker resolves with; null stands for a cancelled dialog. */
	selection: unknown;
}

/**
 * The picker is stubbed through a self-contained factory that stashes its
 * registry on `globalThis`: this module cannot be mocked from a `vi.hoisted`
 * binding, which trips Vitest's mock hoisting.
 */
vi.mock('#documents/dialogs/PoolSpendOfferDialog.svelte.ts', () => {
	const globals = globalThis as Record<string, any>;
	const registry: SpendDialogMock = (globals.__poolSpendDialogMock ??= {
		instances: [],
		selection: null,
	});

	return {
		default: class MockPoolSpendOfferDialog {
			promise: Promise<unknown>;
			entry: { args: unknown[]; rendered: boolean };

			constructor(...args: unknown[]) {
				this.promise = Promise.resolve(registry.selection);
				this.entry = { args, rendered: false };
				registry.instances.push(this.entry);
			}

			render() {
				this.entry.rendered = true;
			}
		},
	};
});

const mocks = vi.hoisted(() => ({
	getPools: vi.fn(),
	getDicePoolConsumers: vi.fn(),
	requestIncomingAttackReaction: vi.fn(),
}));

vi.mock('#utils/dicePool/dicePoolSync.js', () => ({ getPools: mocks.getPools }));
vi.mock('#utils/dicePool/dicePoolConsumers.js', () => ({
	getDicePoolConsumers: mocks.getDicePoolConsumers,
}));
vi.mock('#utils/incomingAttackReactions.js', () => ({
	INCOMING_REACTION_REJECTED_HOOK: 'nimble.incomingReactionRejected',
	requestIncomingAttackReaction: mocks.requestIncomingAttackReaction,
}));
vi.mock('./confirmRerollHeroicReaction.js', () => ({
	confirmRerollHeroicReaction: vi.fn(async () => false),
}));

import { render, screen, within } from '@testing-library/svelte';
import IncomingReactionPromptsTestHarness from './IncomingReactionPrompts.testHarness.svelte';

const { getPools, getDicePoolConsumers, requestIncomingAttackReaction } = mocks;

function spendDialogMock(): SpendDialogMock {
	const globals = globalThis as Record<string, any>;
	return (globals.__poolSpendDialogMock ??= { instances: [], selection: null });
}

interface EntryOptions {
	id?: string;
	kind?: 'forceReroll' | 'redirectToSelf' | 'spendPoolForDamage' | 'reroll';
	source?: 'baseline' | 'rule';
	actorUuid?: string;
	label?: string;
	used?: boolean;
	itemUuid?: string;
	ruleId?: string;
	usedAmount?: number;
	usedPoolLabel?: string;
	usedFaces?: number[];
}

function createEntry(options: EntryOptions = {}) {
	return {
		id: options.id ?? 'entry-1',
		kind: options.kind ?? 'redirectToSelf',
		source: options.source ?? 'rule',
		actorUuid: options.actorUuid ?? 'Actor.protector',
		tokenUuid: 'Scene.s.Token.protector',
		targetTokenUuid: 'Scene.s.Token.victim',
		label: options.label ?? 'Aura of Refuge',
		ruleId: options.ruleId ?? 'rule-1',
		itemUuid: options.itemUuid ?? '',
		used: options.used ?? false,
		...(options.usedAmount === undefined ? {} : { usedAmount: options.usedAmount }),
		...(options.usedPoolLabel === undefined ? {} : { usedPoolLabel: options.usedPoolLabel }),
		...(options.usedFaces === undefined ? {} : { usedFaces: options.usedFaces }),
	};
}

function createMessage(
	entries: ReturnType<typeof createEntry>[],
	lastReroll: Record<string, unknown> | null = null,
	speakerUuid: string | null = null,
) {
	const message = {
		id: 'message-1',
		speakerActor: speakerUuid ? { uuid: speakerUuid } : null,
		system: { incomingReactions: entries, lastReroll },
		reactive: null as unknown,
		canStillUseReroll: vi.fn(() => true),
	};
	message.reactive = message;
	return message;
}

/** A crit-only Fury spend offered on the attacker's own card. */
function spendEntry(options: EntryOptions = {}) {
	return createEntry({
		id: 'spend-1',
		kind: 'spendPoolForDamage',
		label: 'Death Blow: bonus damage',
		itemUuid: 'Item.death-blow',
		ruleId: 'death-blow-fury-consumer',
		...options,
	});
}

function useConsumer(consumer: { ruleId: string; itemId: string | null } | null, poolId = 'fury') {
	getPools.mockReturnValue([{ id: poolId, label: 'Fury Dice', faces: [4, 5] }]);
	getDicePoolConsumers.mockReturnValue(consumer ? [consumer] : []);
}

let previousFromUuidSync: unknown;
let previousGameUser: unknown;
let previousUi: unknown;
let previousHooks: unknown;
let rejectionListener: ((payload: unknown) => void) | null = null;

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	previousUi = g.ui;
	previousHooks = g.Hooks;

	spendDialogMock().instances.length = 0;
	spendDialogMock().selection = null;
	rejectionListener = null;
	vi.clearAllMocks();
	requestIncomingAttackReaction.mockResolvedValue(true);

	g.fromUuidSync = vi.fn((uuid: string) =>
		uuid === 'Item.death-blow'
			? { id: 'item-death-blow', name: 'Death Blow' }
			: { name: 'Sir Brannon', isOwner: true },
	);
	g.game = g.game ?? {};
	g.game.user = { isGM: true, id: 'gm' };
	g.ui = { notifications: { warn: vi.fn(), error: vi.fn() } };
	g.Hooks = {
		on: vi.fn((_hook: string, listener: (payload: unknown) => void) => {
			rejectionListener = listener;
			return 1;
		}),
		off: vi.fn(),
	};
});

afterEach(() => {
	const g = globalThis as Record<string, any>;
	g.fromUuidSync = previousFromUuidSync;
	if (g.game) g.game.user = previousGameUser;
	g.ui = previousUi;
	g.Hooks = previousHooks;
});

const rollPlace = () => within(screen.getByTestId('roll-place'));
const optionsPlace = () => within(screen.getByTestId('options-place'));

describe('IncomingReactionPrompts', () => {
	it('puts a rule-granted Interpose under Options, with the actor name above it', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		const button = optionsPlace().getByRole('button');
		expect(button.textContent?.trim()).toBe('Interpose: Aura of Refuge');
		expect(optionsPlace().getByText('Sir Brannon')).toBeTruthy();
		expect(screen.getByTestId('roll-place').textContent?.trim()).toBe('');
	});

	it('shows the Heroic Reaction cost on the baseline Interpose button', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry({ source: 'baseline', label: '' })]) },
		});

		const button = optionsPlace().getByRole('button');
		expect(button.textContent).toContain('Interpose');
		expect(button.textContent).toContain('Heroic Reaction');
	});

	it('puts a force reroll in the roll section, named for its feature', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ kind: 'forceReroll', label: "Mountain's Endurance" }),
				]),
			},
		});

		const button = rollPlace().getByRole('button');
		expect(button.textContent?.trim()).toBe("Reroll with Mountain's Endurance");
		expect(optionsPlace().queryByRole('button')).toBeNull();
	});

	it('tells a used force reroll at the roll', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ kind: 'forceReroll', label: "Mountain's Endurance", used: true }),
				]),
			},
		});

		expect(rollPlace().getByText("Attack rerolled by Mountain's Endurance")).toBeTruthy();
	});

	it('renders an attribution line instead of a button for used entries', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry({ used: true })]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(optionsPlace().getByText(/Sir Brannon/)).toBeTruthy();
	});

	it('renders nothing when there are no entries', () => {
		const { container } = render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([]) },
		});

		expect(container.querySelector('section')).toBeNull();
	});

	it('hides pending buttons from non-owners who are not GMs', () => {
		const g = globalThis as Record<string, any>;
		g.game.user = { isGM: false, id: 'player' };
		g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: false }));

		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
	});

	describe('card-side spend offers', () => {
		it('labels a spend offer with its feature name and no actor name', () => {
			// The card's speaker already attributes the attacker, and the rule label
			// is written for the rules builder rather than for players
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			const button = screen.getByRole('button');
			expect(button.textContent).toContain('Add Damage');
			expect(button.textContent).toContain('Death Blow');
			expect(button.textContent).not.toContain('Sir Brannon');
		});

		it('attributes a used spend with its amount, pool and faces', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage([
						spendEntry({
							used: true,
							usedAmount: 18,
							usedPoolLabel: 'Fury Dice',
							usedFaces: [4, 5],
						}),
					]),
				},
			});

			expect(screen.getByText('Death Blow: +18 damage (Fury Dice: 4, 5)')).toBeTruthy();
		});

		it('falls back to the feature name when a used spend recorded no amount', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry({ used: true })]) },
			});

			expect(screen.getByText('Death Blow')).toBeTruthy();
		});

		it('opens the picker against the pool and item the live consumer resolves to', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();
			await vi.waitFor(() => expect(spendDialogMock().instances).toHaveLength(1));

			const [actor, poolId, ruleId, itemId] = spendDialogMock().instances[0].args;
			expect(poolId).toBe('fury');
			expect(ruleId).toBe('death-blow-fury-consumer');
			expect(itemId).toBe('item-death-blow');
			expect(actor).toBeTruthy();
			expect(spendDialogMock().instances[0].rendered).toBe(true);
		});

		it('refuses to open the picker when no live consumer matches the offer', async () => {
			// Rule ids are only unique within an item, so a consumer on another item
			// must not satisfy this offer
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-something-else' });
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();

			await vi.waitFor(() =>
				expect((globalThis as Record<string, any>).ui.notifications.warn).toHaveBeenCalledWith(
					"That feature's dice pool is no longer available.",
				),
			);
			expect(spendDialogMock().instances).toHaveLength(0);
			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
		});

		it('does not relay a cancelled pick', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			spendDialogMock().selection = null;
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();
			await vi.waitFor(() => expect(spendDialogMock().instances).toHaveLength(1));

			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			expect(screen.queryByRole('button')).toBeTruthy();
		});

		it('holds the button once a pick is handed off, so it cannot be spent twice', async () => {
			// The request is a socket emit for a player: it returns long before the
			// GM writes `used`, and a second confirm in that window would read the
			// same unspent pool
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			spendDialogMock().selection = { poolId: 'fury', faceIndices: [0], expectedFaces: [4] };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();

			await vi.waitFor(() =>
				expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
					messageId: 'message-1',
					entryId: 'spend-1',
					selection: spendDialogMock().selection,
				}),
			);
			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());
		});

		it('releases the hold when the GM reports the spend was refused', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			spendDialogMock().selection = { poolId: 'fury', faceIndices: [0], expectedFaces: [4] };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();
			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());

			rejectionListener?.({ messageId: 'message-1', entryId: 'spend-1' });

			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeTruthy());
		});

		it('ignores a refusal aimed at a different card', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			spendDialogMock().selection = { poolId: 'fury', faceIndices: [0], expectedFaces: [4] };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			screen.getByRole('button').click();
			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());

			rejectionListener?.({ messageId: 'another-message', entryId: 'spend-1' });

			await Promise.resolve();
			expect(screen.queryByRole('button')).toBeNull();
		});
	});

	describe('Reroll rule entries', () => {
		// Room below the Wound maximum, so a Wound cost can be paid.
		const system = { attributes: { wounds: { value: 0, max: 6 } } };
		const ACTORS: Record<string, { name: string; isOwner: boolean; system: typeof system }> = {
			'Actor.wren': { name: 'Wren', isOwner: true, system },
			'Actor.bram': { name: 'Bram', isOwner: false, system },
		};
		let rerollCost: Record<string, unknown>;

		beforeEach(() => {
			rerollCost = {
				chargePoolIdentifier: '',
				chargeCost: 1,
				manaCost: 0,
				woundCost: 0,
				heroicReaction: '',
			};
			(globalThis as Record<string, any>).fromUuidSync = vi.fn((uuid: string) => {
				if (uuid === 'Item.sand') {
					return {
						name: 'Pocket Sand',
						rules: new Map([
							['reroll-1', { type: 'reroll', id: 'reroll-1', disabled: false, rerollCost }],
						]),
					};
				}
				return ACTORS[uuid] ?? { name: 'Brom', isOwner: true, system };
			});
		});

		function rerollEntry(options: EntryOptions = {}) {
			return createEntry({
				id: 'reroll-entry',
				kind: 'reroll',
				label: 'Pocket Sand rule',
				itemUuid: 'Item.sand',
				ruleId: 'reroll-1',
				...options,
			});
		}

		function lastReroll(overrides: Record<string, unknown> = {}) {
			return {
				entryId: 'reroll-entry',
				itemUuid: 'Item.sand',
				label: 'Pocket Sand rule',
				actorUuid: 'Actor.wren',
				previousResult: 7,
				previousWasCritical: false,
				newResult: 4,
				usesLeft: null,
				woundsGained: 0,
				...overrides,
			};
		}

		/** Wren and Bram each have a reroll; only Wren is owned by the player. */
		function twoActorMessage() {
			return createMessage([
				rerollEntry({ id: 'wren-1', actorUuid: 'Actor.wren' }),
				createEntry({
					id: 'bram-1',
					kind: 'forceReroll',
					actorUuid: 'Actor.bram',
					label: "Mountain's Endurance",
				}),
				rerollEntry({ id: 'wren-2', actorUuid: 'Actor.wren' }),
			]);
		}

		function groupNames(): string[] {
			return [
				...screen
					.getByTestId('roll-place')
					.querySelectorAll('.nimble-incoming-reaction-group__actor'),
			].map((label) => label.textContent?.trim() ?? '');
		}

		it('shows a "Reroll with" button named for the feature, in the roll section', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			expect(rollPlace().getByRole('button').textContent?.trim()).toBe('Reroll with Pocket Sand');
			expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
		});

		it('groups the buttons by actor, with the name above each group', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(groupNames()).toEqual(['Wren', 'Bram']);
			const groups = screen
				.getByTestId('roll-place')
				.querySelectorAll('.nimble-incoming-reaction-group');
			expect(within(groups[0] as HTMLElement).getAllByRole('button')).toHaveLength(2);
			expect(within(groups[1] as HTMLElement).getAllByRole('button')).toHaveLength(1);
			for (const button of rollPlace().getAllByRole('button')) {
				expect(button.textContent).not.toContain('Wren');
				expect(button.textContent).not.toContain('Bram');
			}
		});

		it('shows a player only the groups of the actors they own', () => {
			(globalThis as Record<string, any>).game.user = { isGM: false, id: 'player' };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(groupNames()).toEqual(['Wren']);
			expect(rollPlace().getAllByRole('button')).toHaveLength(2);
		});

		it('shows the GM every group', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(groupNames()).toEqual(['Wren', 'Bram']);
			expect(rollPlace().getAllByRole('button')).toHaveLength(3);
		});

		it('shows the cost at the right of the button', () => {
			rerollCost.woundCost = 1;
			rerollCost.heroicReaction = 'defend';
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			const cost = screen
				.getByTestId('roll-place')
				.querySelector('.nimble-incoming-reaction-button__cost');
			expect(cost?.textContent).toBe('1 Wound, Heroic Reaction');
		});

		describe('with the Costs toggle off', () => {
			let previousSettings: unknown;

			beforeEach(() => {
				const g = globalThis as Record<string, any>;
				previousSettings = g.game.settings;
				g.game.settings = {
					get: (_scope: string, key: string) => key !== 'automation.resourceSpending',
				};
			});

			afterEach(() => {
				(globalThis as Record<string, any>).game.settings = previousSettings;
			});

			const costText = () =>
				screen
					.getByTestId('roll-place')
					.querySelector('.nimble-incoming-reaction-button__cost')
					?.textContent?.trim() ?? '';

			it('shows only the heroic reaction, the one part still spent', () => {
				rerollCost.chargePoolIdentifier = 'sand';
				rerollCost.manaCost = 2;
				rerollCost.woundCost = 1;
				rerollCost.heroicReaction = 'defend';
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: createMessage([rerollEntry()]) },
				});

				expect(costText()).toBe('Heroic Reaction');
			});

			it('shows no cost when the reroll uses no heroic reaction', () => {
				rerollCost.chargePoolIdentifier = 'sand';
				rerollCost.manaCost = 2;
				rerollCost.woundCost = 1;
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: createMessage([rerollEntry()]) },
				});

				expect(costText()).toBe('');
			});
		});

		it('asks the GM to reroll when the button is pressed', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			screen.getByRole('button').click();
			await Promise.resolve();
			await Promise.resolve();

			expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
				messageId: 'message-1',
				entryId: 'reroll-entry',
				forceHeroicReaction: false,
			});
		});

		it('asks the card whether each reroll can still be used, and hides it when not', () => {
			const message = createMessage([rerollEntry()]);
			message.canStillUseReroll.mockReturnValue(false);
			render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

			expect(message.canStillUseReroll).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'reroll-entry' }),
			);
			expect(screen.queryByRole('button')).toBeNull();
		});

		it('tells the last reroll at the roll, with who used it under it', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage([rerollEntry({ used: true })], lastReroll()),
				},
			});

			expect(screen.queryByRole('button')).toBeNull();
			expect(rollPlace().getByText('Rerolled with Pocket Sand: 7 became 4')).toBeTruthy();
			expect(rollPlace().getByText('Used by Wren')).toBeTruthy();
			expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
		});

		it('says so when the reroll took away a crit', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ used: true })],
						lastReroll({
							previousResult: 8,
							previousWasCritical: true,
							usesLeft: 1,
							woundsGained: 1,
						}),
					),
				},
			});

			expect(rollPlace().getByText('Rerolled with Pocket Sand: 8 (crit) became 4')).toBeTruthy();
			expect(rollPlace().getByText('Used by Wren - Uses left: 1 - Wounds gained: 1')).toBeTruthy();
		});

		it('keeps the well under the history line while another reroll can still be used', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ used: true }), rerollEntry({ id: 'reroll-2', actorUuid: 'Actor.bram' })],
						lastReroll(),
					),
				},
			});

			const roll = screen.getByTestId('roll-place');
			const history = roll.querySelector('.nimble-roll-changes__history');
			const well = roll.querySelector('.nimble-roll-changes__well');
			expect(history?.textContent).toContain('7 became 4');
			expect(well?.textContent).toContain('Reroll with Pocket Sand');
			expect(history?.compareDocumentPosition(well as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		});

		it('leaves out the name of the one who rolled, which the card header shows', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[
							rerollEntry({ id: 'wren-1', actorUuid: 'Actor.wren' }),
							rerollEntry({ id: 'bram-1', actorUuid: 'Actor.bram' }),
						],
						lastReroll({ usesLeft: 1 }),
						'Actor.wren',
					),
				},
			});

			expect(groupNames()).toEqual(['Bram']);
			expect(rollPlace().queryByText(/Used by/)).toBeNull();
		});

		it('names the button "Reroll again" when the last feature can reroll again', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ id: 'again', actorUuid: 'Actor.wren' })],
						lastReroll({ usesLeft: 1 }),
					),
				},
			});

			const button = rollPlace().getByRole('button');
			expect(button.querySelector('.nimble-incoming-reaction-button__label')?.textContent).toBe(
				'Reroll again',
			);
			expect(groupNames()).toEqual(['Wren']);
			expect(rollPlace().queryByText(/Used by|Uses left/)).toBeNull();
		});

		it('shows no detail line when the header and the button already say it all', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ id: 'again', actorUuid: 'Actor.wren' })],
						lastReroll({ usesLeft: 1 }),
						'Actor.wren',
					),
				},
			});

			expect(
				screen.getByTestId('roll-place').querySelector('.nimble-roll-changes__detail'),
			).toBeNull();
			expect(rollPlace().getByText('Rerolled with Pocket Sand: 7 became 4')).toBeTruthy();
		});

		it('puts no em dash and no middle dot in any label', () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			rerollCost.woundCost = 2;
			const { container } = render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[
							rerollEntry({ actorUuid: 'Actor.wren' }),
							createEntry({ id: 'force', kind: 'forceReroll', actorUuid: 'Actor.bram' }),
							createEntry({ id: 'rule-interpose', actorUuid: 'Actor.bram' }),
							createEntry({
								id: 'baseline',
								source: 'baseline',
								label: '',
								actorUuid: 'Actor.bram',
							}),
							createEntry({ id: 'used-interpose', used: true }),
							spendEntry(),
						],
						lastReroll({ usesLeft: 1, woundsGained: 2 }),
					),
				},
			});

			expect(container.querySelectorAll('button').length).toBeGreaterThan(4);
			// Em dash, en dash and middle dot, by code point.
			for (const mark of [0x2014, 0x2013, 0xb7].map((code) => String.fromCodePoint(code))) {
				expect(container.textContent).not.toContain(mark);
			}
		});
	});
});
