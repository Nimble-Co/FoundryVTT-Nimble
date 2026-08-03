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

import { render, screen } from '@testing-library/svelte';
import IncomingReactionPromptsTestHarness from './IncomingReactionPrompts.testHarness.svelte';

const { getPools, getDicePoolConsumers, requestIncomingAttackReaction } = mocks;

function spendDialogMock(): SpendDialogMock {
	const globals = globalThis as Record<string, any>;
	return (globals.__poolSpendDialogMock ??= { instances: [], selection: null });
}

interface EntryOptions {
	id?: string;
	kind?: 'forceReroll' | 'redirectToSelf' | 'spendPoolForDamage';
	source?: 'baseline' | 'rule';
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
		actorUuid: 'Actor.protector',
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

function createMessage(entries: ReturnType<typeof createEntry>[]) {
	const message = {
		id: 'message-1',
		system: { incomingReactions: entries },
		reactive: null as unknown,
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

describe('IncomingReactionPrompts', () => {
	it('renders a labeled button for a pending rule-granted redirect entry', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('Interpose');
		expect(button.textContent).toContain('Aura of Refuge');
		expect(button.textContent).toContain('Sir Brannon');
	});

	it('renders a force reroll button with its granting feature label', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ kind: 'forceReroll', label: "Mountain's Endurance" }),
				]),
			},
		});

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('Force Reroll');
		expect(button.textContent).toContain("Mountain's Endurance");
	});

	it('renders an attribution line instead of a button for used entries', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry({ used: true })]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText(/Sir Brannon/)).toBeTruthy();
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
});
