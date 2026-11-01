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
	requestKeepChoice: vi.fn(),
}));

vi.mock('#utils/dicePool/dicePoolSync.js', () => ({ getPools: mocks.getPools }));
vi.mock('#utils/dicePool/dicePoolConsumers.js', () => ({
	getDicePoolConsumers: mocks.getDicePoolConsumers,
}));
vi.mock('#utils/incomingReactions/incomingAttackReactions.js', () => ({
	INCOMING_REACTION_REJECTED_HOOK: 'nimble.incomingReactionRejected',
	requestIncomingAttackReaction: mocks.requestIncomingAttackReaction,
	requestKeepChoice: mocks.requestKeepChoice,
}));
vi.mock('../confirmRerollHeroicReaction.js', () => ({
	confirmRerollHeroicReaction: vi.fn(async () => false),
}));

import { fireEvent, render, screen, within } from '@testing-library/svelte';
import IncomingReactionPromptsTestHarness from './IncomingReactionPrompts.testHarness.svelte';

const { getPools, getDicePoolConsumers, requestIncomingAttackReaction, requestKeepChoice } = mocks;

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
	leftOut?: unknown;
	use?: 'reroll' | 'change' | 'crit';
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
		...(options.leftOut === undefined ? {} : { leftOut: options.leftOut }),
		...(options.use === undefined ? {} : { use: options.use }),
	};
}

function createMessage(
	entries: ReturnType<typeof createEntry>[],
	rerolls: Record<string, unknown>[] = [],
	speakerUuid: string | null = null,
) {
	const message = {
		id: 'message-1',
		// The card draws its damage section, so all rows sit at the roll.
		effectNodes: [[{ type: 'damage' }]] as { type: string }[][],
		speakerActor: speakerUuid ? { uuid: speakerUuid } : null,
		system: { incomingReactions: entries, rerolls },
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
let rejectionListeners: ((payload: unknown) => void)[] = [];

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	previousUi = g.ui;
	previousHooks = g.Hooks;

	spendDialogMock().instances.length = 0;
	spendDialogMock().selection = null;
	rejectionListeners = [];
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
			rejectionListeners.push(listener);
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

type Place = ReturnType<typeof rollPlace>;

const controlButton = (place: Place) => place.getByRole('button', { name: /^Change This Roll/ });

/** Opens Change This Roll. It can be open already: its state stays per message id. */
async function openControl(place: Place): Promise<void> {
	const button = controlButton(place);
	if (button.getAttribute('aria-expanded') !== 'true') await fireEvent.click(button);
}

/** Opens Change This Roll and clicks a row in it. */
async function useFeature(place: Place, row: RegExp | string): Promise<void> {
	await openControl(place);
	await fireEvent.click(place.getByRole('button', { name: row }));
}

function actorHeadings(root: HTMLElement): string[] {
	return [...root.querySelectorAll('.nimble-change-roll__actor')].map(
		(heading) => heading.textContent?.trim() ?? '',
	);
}

const rowsOf = (root: HTMLElement) => [
	...root.querySelectorAll<HTMLButtonElement>('.nimble-change-roll__row'),
];

const rowWords = (row: HTMLElement) => row.textContent?.replace(/\s+/g, ' ').trim();

describe('IncomingReactionPrompts', () => {
	it('puts a rule-granted Interpose in the control at the roll, with the actor name above it', async () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry()]) },
		});

		await openControl(rollPlace());

		const row = rollPlace().getByRole('button', { name: 'Interpose with Aura of Refuge' });
		expect(rowWords(row)).toBe('Interpose with Aura of Refuge');
		expect(actorHeadings(screen.getByTestId('roll-place'))).toEqual(['Sir Brannon']);
		expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
	});

	it('puts the rows that do not change the roll under the card when it has no damage section', async () => {
		const message = createMessage([
			createEntry(),
			createEntry({ id: 'reroll', kind: 'reroll', label: 'Pocket Sand' }),
		]);
		message.effectNodes = [];
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		// The test renders the roll place too; a real card with no damage section does not.
		await openControl(optionsPlace());

		expect(rowsOf(screen.getByTestId('options-place')).map(rowWords)).toEqual([
			'Interpose with Aura of Refuge',
		]);
	});

	it('shows the Heroic Reaction cost on the baseline Interpose row, with no feature', async () => {
		render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: createMessage([createEntry({ source: 'baseline', label: '' })]) },
		});

		await openControl(rollPlace());

		const [row] = rowsOf(screen.getByTestId('roll-place'));
		expect(rowWords(row)).toBe('Interpose Heroic Reaction');
		expect(row.getAttribute('aria-label')).toBe('Interpose (Heroic Reaction)');
	});

	it('tells a change of the die at the roll: set on the arrow and the crit tag', () => {
		const message = createMessage(
			[],
			[
				{
					entryId: 'vo-entry',
					itemUuid: 'Item.vo',
					ruleId: 'vo',
					label: 'Vicious Opportunist',
					actorUuid: 'Actor.cheat',
					faces: 8,
					previous: { value: 3, outcome: null },
					next: { value: 8, outcome: 'crit' },
					usesLeft: null,
					woundsGained: 0,
					use: 'change',
					change: { mode: 'set', value: 0 },
				},
			],
			'Actor.cheat',
		);
		const names = (globalThis as Record<string, any>).fromUuidSync;
		(globalThis as Record<string, any>).fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Item.vo' ? { name: 'Vicious Opportunist' } : names(uuid),
		);
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		expect(
			rollPlace().getByText('Changed with Vicious Opportunist: 3 became 8, a crit'),
		).toBeTruthy();
		expect(rollPlace().getByText('set')).toBeTruthy();
		expect(rollPlace().getByText('Crit')).toBeTruthy();
	});

	it('shows one line per Primary Die Bonus at the roll only', () => {
		const message = createMessage([]);
		Object.assign(message.system, {
			primaryDieBonuses: [
				{ label: 'Unerring Judgment', value: 1, itemUuid: 'Item.judgment' },
				{ label: 'Clumsy Grip', value: -1, itemUuid: 'Item.grip' },
			],
		});
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		expect(rollPlace().getByText('Unerring Judgment: +1 to the Primary Die')).toBeTruthy();
		expect(rollPlace().getByText('Clumsy Grip: -1 to the Primary Die')).toBeTruthy();
		expect(rollPlace().getByText('+1 to Primary Die')).toBeTruthy();
		expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
	});

	it('marks the Primary Die Bonus lines "not added" after a set, and tells why', () => {
		const message = createMessage(
			[],
			[
				{
					use: 'change',
					itemUuid: '',
					label: 'Judgment',
					change: { mode: 'set', value: 0 },
					next: { value: 8, outcome: 'crit' },
					previous: { value: 3, outcome: null },
				},
			],
		);
		Object.assign(message.system, {
			primaryDieBonuses: [{ label: 'Unerring Judgment', value: 1, itemUuid: 'Item.judgment' }],
			activation: {
				effects: [
					{
						id: 'damage',
						type: 'damage',
						roll: { class: 'DamageRoll', options: { primaryDieBonusOff: true }, terms: [] },
					},
				],
			},
		});
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		expect(rollPlace().getByText('+1 bonus not added')).toBeTruthy();
		expect(rollPlace().queryByText('+1 to Primary Die')).toBeNull();
		expect(rollPlace().getByText(/Judgment changed the die to 8/)).toBeTruthy();
	});

	it('shows the outcome tags at the roll only', () => {
		const message = createMessage([]);
		Object.assign(message.system, {
			targets: ['Scene.s.Token.t'],
			activation: {
				effects: [
					{
						id: 'damage',
						type: 'damage',
						roll: {
							class: 'DamageRoll',
							isCritical: true,
							options: { outcomeSources: { forcedCrit: ['target Stunned'] } },
							terms: [{ faces: 6, results: [{ result: 3, active: true }] }],
						},
					},
				],
			},
		});
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		expect(rollPlace().getByText('Crit: target Stunned')).toBeTruthy();
		expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
	});

	it('tells a used legacy forceReroll entry at the roll, as old cards did', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ id: 'used', kind: 'forceReroll', label: 'Old Feature', used: true }),
				]),
			},
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(rollPlace().getByText('Attack rerolled by Old Feature')).toBeTruthy();
		expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
	});

	it('names the actor when a used legacy forceReroll entry has no label', () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ id: 'used', kind: 'forceReroll', label: '', used: true }),
				]),
			},
		});

		expect(rollPlace().getByText('Attack rerolled by Sir Brannon')).toBeTruthy();
	});

	it('shows nothing for a waiting legacy forceReroll entry, which nothing can resolve', () => {
		const { container } = render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ id: 'waiting', kind: 'forceReroll', label: 'Old Feature' }),
				]),
			},
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('still shows the other entries of an old card with a legacy forceReroll entry', async () => {
		render(IncomingReactionPromptsTestHarness, {
			props: {
				messageDocument: createMessage([
					createEntry({ id: 'legacy', kind: 'forceReroll', label: 'Old Feature' }),
					createEntry({ id: 'interpose' }),
				]),
			},
		});

		await openControl(rollPlace());
		expect(rowsOf(screen.getByTestId('roll-place')).map(rowWords)).toEqual([
			'Interpose with Aura of Refuge',
		]);
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
		it('labels a spend offer with its feature name and no actor name', async () => {
			// The card's speaker already attributes the attacker, and the rule label
			// is written for the rules builder rather than for players
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			await openControl(rollPlace());

			const row = rollPlace().getByRole('button', { name: 'Add Damage with Death Blow' });
			expect(rowWords(row)).toBe('Add Damage with Death Blow');
			expect(row.textContent).not.toContain('Sir Brannon');
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

			await useFeature(rollPlace(), /Add Damage with Death Blow/);
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

			await useFeature(rollPlace(), /Add Damage with Death Blow/);

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

			await useFeature(rollPlace(), /Add Damage with Death Blow/);
			await vi.waitFor(() => expect(spendDialogMock().instances).toHaveLength(1));

			expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			expect(controlButton(rollPlace())).toBeTruthy();
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

			await useFeature(rollPlace(), /Add Damage with Death Blow/);

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

			await useFeature(rollPlace(), /Add Damage with Death Blow/);
			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());

			for (const listener of rejectionListeners)
				listener({ messageId: 'message-1', entryId: 'spend-1' });

			await vi.waitFor(() => expect(controlButton(rollPlace())).toBeTruthy());
		});

		it('ignores a refusal aimed at a different card', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			spendDialogMock().selection = { poolId: 'fury', faceIndices: [0], expectedFaces: [4] };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([spendEntry()]) },
			});

			await useFeature(rollPlace(), /Add Damage with Death Blow/);
			await vi.waitFor(() => expect(screen.queryByRole('button')).toBeNull());

			for (const listener of rejectionListeners) {
				listener({ messageId: 'another-message', entryId: 'spend-1' });
			}

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
							[
								'reroll-1',
								{ type: 'reroll', id: 'reroll-1', disabled: false, rollUseCost: rerollCost },
							],
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

		function rerollRecord(overrides: Record<string, unknown> = {}) {
			return {
				entryId: 'reroll-entry',
				itemUuid: 'Item.sand',
				ruleId: 'reroll-1',
				label: 'Pocket Sand rule',
				actorUuid: 'Actor.wren',
				faces: 8,
				previous: { value: 7, outcome: null },
				next: { value: 4, outcome: null },
				usesLeft: null,
				woundsGained: 0,
				...overrides,
			};
		}

		/** Wren and Bram each have a reroll; only Wren is owned by the player. */
		function twoActorMessage() {
			return createMessage([
				rerollEntry({ id: 'wren-1', actorUuid: 'Actor.wren' }),
				rerollEntry({ id: 'bram-1', actorUuid: 'Actor.bram' }),
				rerollEntry({ id: 'wren-2', actorUuid: 'Actor.wren' }),
			]);
		}

		/** The creature names over the rows. */
		async function groupNames(): Promise<string[]> {
			await openControl(rollPlace());
			return actorHeadings(screen.getByTestId('roll-place'));
		}

		it('shows a row with the verb, the feature and no menu, in the roll section', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			await openControl(rollPlace());

			const row = rollPlace().getByRole('button', { name: 'Reroll with Pocket Sand' });
			expect(row.querySelector('.nimble-change-roll__verb')?.textContent).toBe('Reroll');
			expect(row.querySelector('.nimble-change-roll__feature')?.textContent).toBe(
				'with Pocket Sand',
			);
			expect(row.querySelector('i')).toBeNull();
			expect(rollPlace().queryByRole('menu')).toBeNull();
			expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
		});

		it('puts the rows under the name of each actor', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(await groupNames()).toEqual(['Wren', 'Bram']);
			const wren = rollPlace().getByRole('group', { name: 'Wren' });
			const bram = rollPlace().getByRole('group', { name: 'Bram' });
			expect(rowsOf(wren)).toHaveLength(2);
			expect(rowsOf(bram)).toHaveLength(1);
			for (const row of rowsOf(screen.getByTestId('roll-place'))) {
				expect(row.textContent).not.toContain('Wren');
				expect(row.textContent).not.toContain('Bram');
			}
		});

		it('shows a player only the features of the actors they own, and counts only those', async () => {
			(globalThis as Record<string, any>).game.user = { isGM: false, id: 'player' };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(await groupNames()).toEqual(['Wren']);
			expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(2);
			await fireEvent.click(controlButton(rollPlace()));
			expect(controlButton(rollPlace()).textContent?.replace(/\s+/g, ' ').trim()).toBe(
				'Change This Roll (2)',
			);
		});

		it('shows the GM every feature, and counts them all', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: twoActorMessage() },
			});

			expect(await groupNames()).toEqual(['Wren', 'Bram']);
			expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(3);
			await fireEvent.click(controlButton(rollPlace()));
			expect(controlButton(rollPlace()).textContent?.replace(/\s+/g, ' ').trim()).toBe(
				'Change This Roll (3)',
			);
		});

		it('shows the cost at the right of the row, and in its full sentence', async () => {
			rerollCost.woundCost = 1;
			rerollCost.heroicReaction = 'defend';
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			await openControl(rollPlace());

			const [row] = rowsOf(screen.getByTestId('roll-place'));
			expect(row.querySelector('.nimble-change-roll__cost')?.textContent).toBe(
				'Gain 1 Wound, Heroic Reaction',
			);
			expect(row.getAttribute('aria-label')).toBe(
				'Reroll with Pocket Sand (Gain 1 Wound, Heroic Reaction)',
			);
		});

		it('shows the note of the entry under the feature, and in its sentence', async () => {
			const entry = { ...rerollEntry(), hint: 'Your 2nd miss this round' };
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([entry]) },
			});

			await openControl(rollPlace());

			const [row] = rowsOf(screen.getByTestId('roll-place'));
			expect(row.querySelector('.nimble-change-roll__note')?.textContent).toBe(
				'Your 2nd miss this round',
			);
			expect(row.getAttribute('aria-label')).toBe(
				'Reroll with Pocket Sand. Your 2nd miss this round',
			);
		});

		describe('the control', () => {
			let messageNumber = 0;

			/** A message of its own: the open state stays per message id. */
			function controlMessage(system: Record<string, unknown> = {}) {
				const message = createMessage([
					rerollEntry({ id: 'wren-change', actorUuid: 'Actor.wren', use: 'change' }),
					rerollEntry({ id: 'wren-reroll', actorUuid: 'Actor.wren' }),
					rerollEntry({ id: 'bram-reroll', actorUuid: 'Actor.bram' }),
				]);
				message.id = `control-message-${(messageNumber += 1)}`;
				Object.assign(message.system, system);
				return message;
			}

			it('starts closed: one button with the count and a down arrow, and no rows', () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});

				const button = controlButton(rollPlace());
				expect(rollPlace().getAllByRole('button')).toEqual([button]);
				expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Change This Roll (3)');
				expect(button.getAttribute('aria-expanded')).toBe('false');
				expect(button.querySelector('.fa-angle-down')).toBeTruthy();
			});

			it('opens on a click with an up arrow and no count, and uses nothing', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				const button = controlButton(rollPlace());

				await fireEvent.click(button);

				expect(button.getAttribute('aria-expanded')).toBe('true');
				expect(button.querySelector('.fa-angle-up')).toBeTruthy();
				expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Change This Roll');
				expect(button.getAttribute('aria-controls')).toBe(
					rollPlace().getByRole('group', { name: 'Change This Roll' }).getAttribute('id'),
				);
				expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			});

			it('lists the rows of one actor by verb, whatever the order on the card', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});

				await openControl(rollPlace());

				expect(rowsOf(screen.getByTestId('roll-place')).map(rowWords)).toEqual([
					'Reroll with Pocket Sand',
					'Change Die with Pocket Sand',
					'Reroll with Pocket Sand',
				]);
			});

			it('opens by itself on an attack that misses, and takes no focus', () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage({ isMiss: true }) },
				});

				expect(controlButton(rollPlace()).getAttribute('aria-expanded')).toBe('true');
				expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(3);
				expect(document.activeElement).toBe(document.body);
			});

			it('starts closed on a hit and on a crit', () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage({ isMiss: false, isCritical: true }) },
				});

				expect(controlButton(rollPlace()).getAttribute('aria-expanded')).toBe('false');
			});

			it('stays closed through a new draw of the card when the user closed it', async () => {
				const message = controlMessage({ isMiss: true });
				const first = render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: message },
				});
				await fireEvent.click(controlButton(rollPlace()));
				first.unmount();

				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

				expect(controlButton(rollPlace()).getAttribute('aria-expanded')).toBe('false');
			});

			it('uses the row clicked, and the other rows stay', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});

				await useFeature(rollPlace(), /Change Die with/);
				for (let i = 0; i < 4; i++) await Promise.resolve();

				expect(requestIncomingAttackReaction).toHaveBeenCalledWith(
					expect.objectContaining({ entryId: 'wren-change' }),
				);
				await vi.waitFor(() => expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(2));
			});

			it('shows Make Crit and uses it with no die to pick', async () => {
				const message = controlMessage();
				message.system.incomingReactions = [
					rerollEntry({ id: 'wren-crit', actorUuid: 'Actor.wren', use: 'crit' }),
					rerollEntry({ id: 'wren-change', actorUuid: 'Actor.wren', use: 'change' }),
				];
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

				await openControl(rollPlace());
				expect(rowsOf(screen.getByTestId('roll-place')).map(rowWords)).toEqual([
					'Change Die with Pocket Sand',
					'Make Crit with Pocket Sand',
				]);

				await fireEvent.click(rollPlace().getByRole('button', { name: /Make Crit with/ }));
				for (let i = 0; i < 4; i++) await Promise.resolve();

				expect(requestIncomingAttackReaction).toHaveBeenCalledWith(
					expect.objectContaining({ entryId: 'wren-crit' }),
				);
				expect(requestIncomingAttackReaction).not.toHaveBeenCalledWith(
					expect.objectContaining({ die: expect.anything() }),
				);
			});

			it('moves through the rows with the arrow keys, from the button and across the actors', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				await openControl(rollPlace());
				const button = controlButton(rollPlace());
				const rows = rowsOf(screen.getByTestId('roll-place'));

				await fireEvent.keyDown(button, { key: 'ArrowDown' });
				expect(document.activeElement).toBe(rows[0]);
				await fireEvent.keyDown(rows[0], { key: 'ArrowDown' });
				expect(document.activeElement).toBe(rows[1]);
				await fireEvent.keyDown(rows[1], { key: 'ArrowDown' });
				expect(document.activeElement).toBe(rows[2]);
				await fireEvent.keyDown(rows[2], { key: 'ArrowDown' });
				expect(document.activeElement).toBe(rows[0]);
				await fireEvent.keyDown(rows[0], { key: 'ArrowUp' });
				expect(document.activeElement).toBe(rows[2]);
				await fireEvent.keyDown(rows[2], { key: 'Home' });
				expect(document.activeElement).toBe(rows[0]);
				await fireEvent.keyDown(rows[0], { key: 'End' });
				expect(document.activeElement).toBe(rows[2]);
			});

			it('closes on Escape, keeps the Escape from Foundry, and gives the focus to the button', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				const onWindowKeydown = vi.fn();
				window.addEventListener('keydown', onWindowKeydown);
				await openControl(rollPlace());

				await fireEvent.keyDown(rowsOf(screen.getByTestId('roll-place'))[0], { key: 'Escape' });
				window.removeEventListener('keydown', onWindowKeydown);

				expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(0);
				expect(onWindowKeydown).not.toHaveBeenCalled();
				expect(document.activeElement).toBe(controlButton(rollPlace()));
			});

			it('leaves Escape to Foundry when it is closed', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				const onWindowKeydown = vi.fn();
				window.addEventListener('keydown', onWindowKeydown);

				await fireEvent.keyDown(controlButton(rollPlace()), { key: 'Escape' });
				window.removeEventListener('keydown', onWindowKeydown);

				expect(onWindowKeydown).toHaveBeenCalledTimes(1);
			});

			it('stays open on a click outside', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				await openControl(rollPlace());

				await fireEvent.pointerDown(document.body);

				expect(rowsOf(screen.getByTestId('roll-place'))).toHaveLength(3);
			});

			it('gives the focus to the button when the row clicked goes and others stay', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: controlMessage() },
				});
				await openControl(rollPlace());
				const row = rollPlace().getByRole('button', { name: /Change Die with/ });
				row.focus();

				await fireEvent.click(row);

				await vi.waitFor(() => expect(document.activeElement).toBe(controlButton(rollPlace())));
			});

			it('gives the focus to the card when the last row goes', async () => {
				const message = controlMessage();
				message.system.incomingReactions = [rerollEntry({ id: 'only', actorUuid: 'Actor.wren' })];
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });
				await openControl(rollPlace());
				const [row] = rowsOf(screen.getByTestId('roll-place'));
				row.focus();

				await fireEvent.click(row);

				const card = screen.getByTestId('card');
				await vi.waitFor(() => expect(document.activeElement).toBe(card));
				expect(rollPlace().queryByRole('button')).toBeNull();
			});

			it('gives the focus to the card in a new draw, after the last row went', async () => {
				const message = controlMessage();
				message.system.incomingReactions = [rerollEntry({ id: 'only', actorUuid: 'Actor.wren' })];
				const first = render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: message },
				});
				await openControl(rollPlace());
				await fireEvent.click(rowsOf(screen.getByTestId('roll-place'))[0]);
				await vi.waitFor(() => expect(requestIncomingAttackReaction).toHaveBeenCalled());
				first.unmount();
				message.system.incomingReactions = [
					rerollEntry({ id: 'only', actorUuid: 'Actor.wren', used: true }),
				];

				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

				expect(document.activeElement).toBe(screen.getByTestId('card'));
			});

			it('takes no focus from where the user moved it', async () => {
				const message = controlMessage();
				message.system.incomingReactions = [rerollEntry({ id: 'only', actorUuid: 'Actor.wren' })];
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });
				await openControl(rollPlace());
				const elsewhere = document.body.appendChild(document.createElement('input'));
				elsewhere.focus();

				await fireEvent.click(rowsOf(screen.getByTestId('roll-place'))[0]);
				await vi.waitFor(() => expect(rollPlace().queryByRole('button')).toBeNull());

				expect(document.activeElement).toBe(elsewhere);
				elsewhere.remove();
			});
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

			async function costText(): Promise<string> {
				await openControl(rollPlace());
				return (
					screen
						.getByTestId('roll-place')
						.querySelector('.nimble-change-roll__cost')
						?.textContent?.trim() ?? ''
				);
			}

			it('shows only the heroic reaction, the one part still spent', async () => {
				rerollCost.chargePoolIdentifier = 'sand';
				rerollCost.manaCost = 2;
				rerollCost.woundCost = 1;
				rerollCost.heroicReaction = 'defend';
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: createMessage([rerollEntry()]) },
				});

				expect(await costText()).toBe('Heroic Reaction');
			});

			it('shows no cost when the reroll uses no heroic reaction', async () => {
				rerollCost.chargePoolIdentifier = 'sand';
				rerollCost.manaCost = 2;
				rerollCost.woundCost = 1;
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: createMessage([rerollEntry()]) },
				});

				expect(await costText()).toBe('');
			});
		});

		it('asks the GM to reroll when the button is pressed', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: { messageDocument: createMessage([rerollEntry()]) },
			});

			await useFeature(rollPlace(), /Pocket Sand/);
			await Promise.resolve();
			await Promise.resolve();

			expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
				messageId: 'message-1',
				entryId: 'reroll-entry',
				forceHeroicReaction: false,
			});
		});

		describe('a reroll of a die the player picks', () => {
			const primary = { term: 0, result: 0, faces: 8, value: 1, role: 'primary' };
			const pool = { term: 2, result: 0, faces: 6, value: 5, role: 'kept' };

			function pickerMessage(dice: unknown[]) {
				const message = createMessage([rerollEntry()]);
				return Object.assign(message, { rerollDiceToPick: vi.fn(() => dice) });
			}

			async function settle() {
				for (let i = 0; i < 4; i++) await Promise.resolve();
			}

			it('opens the dice under the row, and sends the die the player clicks', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([primary, pool]) },
				});

				await useFeature(rollPlace(), /Reroll with Pocket Sand/);

				const row = rollPlace().getByRole('button', { name: /Reroll with Pocket Sand/ });
				const title = rollPlace().getByText('Pick a die to reroll');
				expect(row.getAttribute('aria-expanded')).toBe('true');
				expect(row.compareDocumentPosition(title)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
				expect(rollPlace().queryByRole('menu')).toBeNull();
				expect(requestIncomingAttackReaction).not.toHaveBeenCalled();

				await fireEvent.click(rollPlace().getByRole('button', { name: 'Reroll the 5' }));
				await settle();

				expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
					messageId: 'message-1',
					entryId: 'reroll-entry',
					forceHeroicReaction: false,
					die: { term: 2, result: 0 },
				});
				expect(rollPlace().getByText('Rerolling with Pocket Sand')).toBeTruthy();
			});

			it('names the Primary Die and puts the focus on it', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([pool, primary]) },
				});

				await useFeature(rollPlace(), /Reroll with Pocket Sand/);
				await settle();

				const primaryButton = rollPlace().getByRole('button', { name: 'Reroll the 1 (Primary)' });
				expect(document.activeElement).toBe(primaryButton);
			});

			it('closes on Cancel or Escape and sends nothing', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([primary, pool]) },
				});
				const open = () => useFeature(rollPlace(), /Reroll with Pocket Sand/);

				await open();
				await fireEvent.click(rollPlace().getByRole('button', { name: 'Cancel' }));
				expect(rollPlace().queryByText('Pick a die to reroll')).toBeNull();

				await open();
				await fireEvent.keyDown(rollPlace().getByRole('button', { name: 'Reroll the 5' }), {
					key: 'Escape',
				});
				expect(rollPlace().queryByText('Pick a die to reroll')).toBeNull();
				expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			});

			it('gives the focus back to the row on Cancel or Escape', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([primary, pool]) },
				});
				const opener = () => rollPlace().getByRole('button', { name: /Reroll with Pocket Sand/ });
				const open = () => useFeature(rollPlace(), /Reroll with Pocket Sand/);

				await open();
				await fireEvent.click(rollPlace().getByRole('button', { name: 'Cancel' }));
				await settle();
				expect(document.activeElement).toBe(opener());

				await open();
				await fireEvent.keyDown(rollPlace().getByRole('button', { name: 'Cancel' }), {
					key: 'Escape',
				});
				await settle();
				expect(document.activeElement).toBe(opener());
			});

			it('closes on Escape while Cancel has the focus', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([primary, pool]) },
				});
				await useFeature(rollPlace(), /Reroll with Pocket Sand/);

				await fireEvent.keyDown(rollPlace().getByRole('button', { name: 'Cancel' }), {
					key: 'Escape',
				});

				expect(rollPlace().queryByText('Pick a die to reroll')).toBeNull();
			});

			it('moves between the dice with the arrow keys', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([primary, pool]) },
				});
				await useFeature(rollPlace(), /Reroll with Pocket Sand/);
				await settle();

				await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
				expect(document.activeElement).toBe(
					rollPlace().getByRole('button', { name: 'Reroll the 5' }),
				);
				await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
				expect(document.activeElement).toBe(
					rollPlace().getByRole('button', { name: 'Reroll the 1 (Primary)' }),
				);
			});

			it('sends the only die there is without a picker', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: pickerMessage([pool]) },
				});

				await useFeature(rollPlace(), /Reroll with Pocket Sand/);
				await settle();

				expect(rollPlace().queryByText('Pick a die to reroll')).toBeNull();
				expect(requestIncomingAttackReaction).toHaveBeenCalledWith(
					expect.objectContaining({ die: { term: 2, result: 0 } }),
				);
			});
		});

		describe('a Change a Die entry', () => {
			const primary = { term: 0, result: 0, faces: 8, value: 3, role: 'primary' };
			const pool = { term: 2, result: 0, faces: 6, value: 5, role: 'kept' };

			function changeMessage(setsValue: boolean, dice: unknown[]) {
				const message = createMessage([rerollEntry({ use: 'change' })]);
				return Object.assign(message, { changeToPick: vi.fn(() => ({ setsValue, dice })) });
			}

			async function settle() {
				for (let i = 0; i < 4; i++) await Promise.resolve();
			}

			const openChange = () => useFeature(rollPlace(), /Change Die with/);
			const valueInput = () =>
				rollPlace().getByRole('spinbutton', { name: 'New value, 1 to 8' }) as HTMLInputElement;

			it('asks for the value of the Primary Die, at the die it has, and sends the value set', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(true, [primary]) },
				});

				await openChange();
				await settle();

				expect(rollPlace().getByText('Pick a value')).toBeTruthy();
				expect(rollPlace().getByRole('img', { name: 'Was 3' })).toBeTruthy();
				expect(valueInput().value).toBe('3');
				expect(document.activeElement).toBe(valueInput());
				const confirm = () => rollPlace().getByRole('button', { name: /^Set to/ });
				expect((confirm() as HTMLButtonElement).disabled).toBe(true);

				await fireEvent.click(rollPlace().getByRole('button', { name: 'Higher' }));
				expect(valueInput().value).toBe('4');
				await fireEvent.click(rollPlace().getByRole('button', { name: '8 (highest)' }));
				expect(confirm().textContent?.trim()).toBe('Set to 8');
				await fireEvent.click(confirm());
				await settle();

				expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
					messageId: 'message-1',
					entryId: 'reroll-entry',
					forceHeroicReaction: false,
					die: { term: 0, result: 0 },
					value: 8,
				});
			});

			it('steps the value with the buttons and the arrow keys, from 1 to the max', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(true, [primary]) },
				});
				await openChange();

				await fireEvent.click(rollPlace().getByRole('button', { name: '1 (lowest)' }));
				expect(
					(rollPlace().getByRole('button', { name: 'Lower' }) as HTMLButtonElement).disabled,
				).toBe(true);
				await fireEvent.keyDown(valueInput(), { key: 'ArrowDown' });
				expect(valueInput().value).toBe('1');
				await fireEvent.keyDown(valueInput(), { key: 'ArrowUp' });
				expect(valueInput().value).toBe('2');
				await fireEvent.keyDown(valueInput(), { key: 'End' });
				expect(valueInput().value).toBe('8');
				expect(
					(rollPlace().getByRole('button', { name: 'Higher' }) as HTMLButtonElement).disabled,
				).toBe(true);
			});

			it('keeps a typed value from 1 to the max, and sends it on Enter', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(true, [primary]) },
				});
				await openChange();

				await fireEvent.input(valueInput(), { target: { value: '12' } });
				await fireEvent.blur(valueInput());
				expect(valueInput().value).toBe('8');
				await fireEvent.input(valueInput(), { target: { value: '0' } });
				await fireEvent.blur(valueInput());
				expect(valueInput().value).toBe('1');

				await fireEvent.input(valueInput(), { target: { value: '6' } });
				await fireEvent.keyDown(valueInput(), { key: 'Enter' });
				await settle();

				expect(requestIncomingAttackReaction).toHaveBeenCalledWith(
					expect.objectContaining({ die: { term: 0, result: 0 }, value: 6 }),
				);
			});

			it('picks the die first for a rule that changes a picked die', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(true, [primary, pool]) },
				});
				await openChange();

				expect(rollPlace().getByText('Pick a die to change')).toBeTruthy();
				await fireEvent.click(rollPlace().getByRole('button', { name: 'Change the 5' }));
				await settle();

				expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
				const input = rollPlace().getByRole('spinbutton', { name: 'New value, 1 to 6' });
				expect((input as HTMLInputElement).value).toBe('5');
				expect(rollPlace().getByRole('button', { name: '6 (highest)' })).toBeTruthy();
			});

			it('sends an add change at once, with the die and no value', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(false, [primary]) },
				});

				await openChange();
				await settle();

				expect(rollPlace().queryByText('Pick a value')).toBeNull();
				expect(requestIncomingAttackReaction).toHaveBeenCalledWith({
					messageId: 'message-1',
					entryId: 'reroll-entry',
					forceHeroicReaction: false,
					die: { term: 0, result: 0 },
				});
			});

			it('sends an add change of a picked die after the die step only', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(false, [primary, pool]) },
				});
				await openChange();

				await fireEvent.click(rollPlace().getByRole('button', { name: 'Change the 5' }));
				await settle();

				expect(rollPlace().queryByText('Pick a value')).toBeNull();
				expect(requestIncomingAttackReaction).toHaveBeenCalledWith(
					expect.not.objectContaining({ value: expect.anything() }),
				);
			});

			it('closes on Cancel or Escape, sends nothing, and gives the focus back', async () => {
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: changeMessage(true, [primary]) },
				});
				const onWindowKeydown = vi.fn();
				window.addEventListener('keydown', onWindowKeydown);
				const opener = () => rollPlace().getByRole('button', { name: /Change Die with/ });

				await openChange();
				await fireEvent.click(rollPlace().getByRole('button', { name: 'Cancel' }));
				await settle();
				expect(rollPlace().queryByText('Pick a value')).toBeNull();
				expect(document.activeElement).toBe(opener());

				await openChange();
				await fireEvent.keyDown(valueInput(), { key: 'Escape' });
				await settle();
				window.removeEventListener('keydown', onWindowKeydown);

				expect(rollPlace().queryByText('Pick a value')).toBeNull();
				expect(onWindowKeydown).not.toHaveBeenCalled();
				expect(document.activeElement).toBe(opener());
				expect(requestIncomingAttackReaction).not.toHaveBeenCalled();
			});
		});

		describe('a result a player keeps', () => {
			function waiting(chooserUuid = 'Actor.wren') {
				const message = createMessage([rerollEntry({ used: true })]);
				(message.system as Record<string, unknown>).pendingKeep = {
					entryId: 'reroll-entry',
					chooserUuid,
					roll: {},
					reroll: rerollRecord(),
					old: { total: 9, outcome: 'miss' },
					new: { total: 12, outcome: 'hit' },
					discardedCritTriggers: false,
				};
				return message;
			}

			it('gives the chooser a Keep button for each roll, and sends the one clicked', async () => {
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: waiting() } });

				expect(rollPlace().getByText('Rerolled with Pocket Sand')).toBeTruthy();
				const keepOld = rollPlace().getByRole('button', { name: /Keep 9/ });
				expect(keepOld.textContent).toContain('Miss');
				expect(rollPlace().getByRole('button', { name: /Keep 12/ }).textContent).toContain('Hit');

				await fireEvent.click(keepOld);

				expect(requestKeepChoice).toHaveBeenCalledWith({ messageId: 'message-1', choice: 'old' });
				expect((keepOld as HTMLButtonElement).disabled).toBe(true);
			});

			it('tells everyone else who chooses, with no buttons', () => {
				(globalThis as Record<string, any>).game.user = { isGM: false, id: 'player' };
				const g = globalThis as Record<string, any>;
				const named = g.fromUuidSync;
				g.fromUuidSync = vi.fn((uuid: string) =>
					uuid === 'Actor.wren' ? { name: 'Wren', isOwner: false } : named(uuid),
				);
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: waiting() } });

				expect(rollPlace().getByText('Wren keeps 9 or 12.')).toBeTruthy();
				expect(rollPlace().queryByRole('button', { name: /Keep/ })).toBeNull();
			});

			it('shows the old die as the one that stands when it was kept', () => {
				render(IncomingReactionPromptsTestHarness, {
					props: {
						messageDocument: createMessage(
							[rerollEntry({ used: true })],
							[rerollRecord({ kept: 'old', keptTotal: 9 })],
						),
					},
				});

				expect(rollPlace().getByText('Rerolled with Pocket Sand, kept 9')).toBeTruthy();
				expect(rollPlace().getByRole('img', { name: 'Now 7' })).toBeTruthy();
				expect(rollPlace().getByRole('img', { name: 'Was 4' })).toBeTruthy();
			});
		});

		describe('ally rerolls the scan left out', () => {
			function leftOutMessage() {
				const message = createMessage([
					rerollEntry({
						id: 'pip',
						actorUuid: 'Actor.pip',
						leftOut: { reason: 'reach', spaces: 7, reach: 6 },
					} as EntryOptions),
				]);
				return Object.assign(message, { addLeftOutReroll: vi.fn(async () => undefined) });
			}

			it('shows the GM one quiet line, and Add gives the reroll its row', async () => {
				const message = leftOutMessage();
				render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

				expect(rollPlace().getByText('1 ally reroll left out')).toBeTruthy();
				expect(rollPlace().getByText('7 spaces away, Reach 6')).toBeTruthy();
				await fireEvent.click(rollPlace().getByRole('button', { name: /^Add Pocket Sand/ }));

				expect(message.addLeftOutReroll).toHaveBeenCalledWith('pip');
			});

			it('stays open when the card renders again', async () => {
				const message = leftOutMessage();
				const first = render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: message },
				});
				await fireEvent.click(rollPlace().getByText('1 ally reroll left out'));
				first.unmount();

				const { container } = render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: message },
				});

				expect(container.querySelector('details')?.open).toBe(true);
			});

			it('shows a player nothing', () => {
				(globalThis as Record<string, any>).game.user = { isGM: false, id: 'player' };
				render(IncomingReactionPromptsTestHarness, {
					props: { messageDocument: leftOutMessage() },
				});

				expect(rollPlace().queryByText('1 ally reroll left out')).toBeNull();
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
					messageDocument: createMessage([rerollEntry({ used: true })], [rerollRecord()]),
				},
			});

			expect(screen.queryByRole('button')).toBeNull();
			expect(rollPlace().getByText('Rerolled with Pocket Sand')).toBeTruthy();
			expect(rollPlace().getByText('Used by Wren')).toBeTruthy();
			expect(rollPlace().getByRole('img', { name: 'Was 7' })).toBeTruthy();
			expect(rollPlace().getByRole('img', { name: 'Now 4' })).toBeTruthy();
			expect(screen.getByTestId('options-place').textContent?.trim()).toBe('');
		});

		it('shows no legacy reroll line on a card with reroll history', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage([rerollEntry({ used: true })], [rerollRecord()]),
				},
			});

			expect(rollPlace().getByText('Rerolled with Pocket Sand')).toBeTruthy();
			expect(
				screen.getByTestId('roll-place').querySelectorAll('.nimble-roll-changes__history'),
			).toHaveLength(1);
			expect(screen.getByTestId('roll-place').textContent).not.toContain('Attack rerolled by');
		});

		it('says so when the reroll took away a crit', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ used: true })],
						[
							rerollRecord({
								previous: { value: 8, outcome: 'crit' },
								usesLeft: 1,
								woundsGained: 1,
							}),
						],
					),
				},
			});

			const old = rollPlace().getByRole('img', { name: 'Was 8, a crit' });
			expect(old.classList.contains('nimble-die-face--discarded')).toBe(true);
			expect(rollPlace().getByText('Used by Wren - Uses left: 1 - Wounds gained: 1')).toBeTruthy();
		});

		it('shows one line per reroll of the last action, the first at the top', () => {
			const globals = globalThis as Record<string, any>;
			const lookUp = globals.fromUuidSync;
			globals.fromUuidSync = vi.fn((uuid: string) =>
				uuid === 'Item.ward' ? { name: 'Warding Bond' } : lookUp(uuid),
			);
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ used: true })],
						[
							rerollRecord({ woundsGained: 1 }),
							rerollRecord({
								entryId: 'ward-entry',
								itemUuid: 'Item.ward',
								label: 'Warding Bond',
								actorUuid: 'Actor.bram',
								faces: null,
							}),
						],
						'Actor.wren',
					),
				},
			});

			const lines = [
				...screen.getByTestId('roll-place').querySelectorAll('.nimble-roll-changes__history'),
			];
			expect(
				lines.map((line) => line.querySelector('p > [aria-hidden="true"]')?.textContent),
			).toEqual(['Pocket Sand', 'Warding Bond']);
			expect(
				lines.map((line) => line.querySelector('.nimble-roll-changes__spoken')?.textContent),
			).toEqual(['Rerolled with Pocket Sand', 'Rerolled with Warding Bond']);
			expect(lines[0].querySelector('.nimble-roll-changes__detail')?.textContent).toBe(
				'Wounds gained: 1',
			);
			expect(lines[0].querySelectorAll('.nimble-die-face')).toHaveLength(2);
			expect(lines[1].querySelector('.nimble-roll-changes__detail')?.textContent).toBe(
				'Used by Bram',
			);
			expect(lines[1].querySelector('.nimble-die-face')).toBeNull();
		});

		it('keeps the control under the history line while another reroll can still be used', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ used: true }), rerollEntry({ id: 'reroll-2', actorUuid: 'Actor.bram' })],
						[rerollRecord()],
					),
				},
			});

			const roll = screen.getByTestId('roll-place');
			const history = roll.querySelector('.nimble-roll-changes__history');
			const control = roll.querySelector('.nimble-change-roll');
			expect(history?.textContent).toContain('Rerolled with Pocket Sand');
			expect(control?.querySelector('button')?.textContent).toContain('Change This Roll');
			expect(history?.compareDocumentPosition(control as Node)).toBe(
				Node.DOCUMENT_POSITION_FOLLOWING,
			);
		});

		it('leaves out the name of the one who rolled, which the card header shows', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[
							rerollEntry({ id: 'wren-1', actorUuid: 'Actor.wren' }),
							rerollEntry({ id: 'bram-1', actorUuid: 'Actor.bram' }),
						],
						[rerollRecord({ usesLeft: 1 })],
						'Actor.wren',
					),
				},
			});

			expect(await groupNames()).toEqual(['Bram']);
			expect(rollPlace().queryByText(/Used by/)).toBeNull();
		});

		it('takes the one who rolled from a check card, which has no speaker', async () => {
			const message = createMessage(
				[
					rerollEntry({ id: 'wren-1', actorUuid: 'Actor.wren' }),
					rerollEntry({ id: 'bram-1', actorUuid: 'Actor.bram' }),
				],
				[rerollRecord({ usesLeft: 1 })],
			);
			Object.assign(message.system, { actorUuid: 'Actor.wren' });
			render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

			expect(await groupNames()).toEqual(['Bram']);
			expect(rollPlace().queryByText(/Used by/)).toBeNull();
		});

		it('says "Reroll Again" when the last feature can reroll again', async () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ id: 'again', actorUuid: 'Actor.wren' })],
						[rerollRecord({ usesLeft: 1 })],
					),
				},
			});

			await openControl(rollPlace());
			const row = rollPlace().getByRole('button', { name: 'Reroll Again with Pocket Sand' });
			expect(rowWords(row)).toBe('Reroll Again with Pocket Sand');
			expect(actorHeadings(screen.getByTestId('roll-place'))).toEqual(['Wren']);
			expect(rollPlace().queryByText(/Used by|Uses left/)).toBeNull();
		});

		it('shows no detail line when the header and the button already say it all', () => {
			render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[rerollEntry({ id: 'again', actorUuid: 'Actor.wren' })],
						[rerollRecord({ usesLeft: 1 })],
						'Actor.wren',
					),
				},
			});

			expect(
				screen.getByTestId('roll-place').querySelector('.nimble-roll-changes__detail'),
			).toBeNull();
			expect(rollPlace().getByText('Rerolled with Pocket Sand')).toBeTruthy();
		});

		it('puts no em dash and no middle dot in any label', async () => {
			useConsumer({ ruleId: 'death-blow-fury-consumer', itemId: 'item-death-blow' });
			rerollCost.woundCost = 2;
			const { container } = render(IncomingReactionPromptsTestHarness, {
				props: {
					messageDocument: createMessage(
						[
							rerollEntry({ actorUuid: 'Actor.wren' }),
							rerollEntry({ id: 'bram-reroll', actorUuid: 'Actor.bram' }),
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
						[rerollRecord({ usesLeft: 1, woundsGained: 2 })],
					),
				},
			});

			await openControl(rollPlace());
			expect(container.querySelectorAll('button').length).toBeGreaterThan(4);
			// Em dash, en dash and middle dot, by code point.
			for (const mark of [0x2014, 0x2013, 0xb7].map((code) => String.fromCodePoint(code))) {
				expect(container.textContent).not.toContain(mark);
			}
		});
	});
});

describe('IncomingReactionPrompts with No Damage', () => {
	const noDamageChange = {
		id: 'click-1',
		lineId: 'click-1',
		entryId: 'entry-1',
		itemUuid: 'Item.res',
		ruleId: 'rule-1',
		label: 'Epic Resistance',
		actorUuid: 'Actor.protector',
		change: 'noDamage',
		value: 0,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		targetTokenUuid: 'Scene.s.Token.victim',
	};

	it('offers a row that tells what it does', () => {
		const entry = { ...createEntry({ id: 'entry-1', kind: 'reroll' }), use: 'result' };
		const message = createMessage([entry as ReturnType<typeof createEntry>]);
		Object.assign(message, { resultUseOf: () => ({ change: 'noDamage', value: 0, stat: '' }) });

		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });

		expect(rollPlace().getByRole('button', { name: /No Damage with/ })).toBeTruthy();
	});

	it('tells the target at the roll, with a Remove until the damage is applied', () => {
		const message = createMessage([]);
		Object.assign(message.system, { resultChanges: [noDamageChange] });

		const first = render(IncomingReactionPromptsTestHarness, {
			props: { messageDocument: message },
		});
		expect(screen.getByTestId('roll-place').textContent).toContain('No Damage for Sir Brannon');
		expect(rollPlace().queryByRole('button', { name: /^Remove/ })).toBeTruthy();
		first.unmount();

		Object.assign(message.system, { damageApplied: true });
		render(IncomingReactionPromptsTestHarness, { props: { messageDocument: message } });
		expect(screen.getByTestId('roll-place').textContent).toContain('No Damage for Sir Brannon');
		expect(rollPlace().queryByRole('button', { name: /^Remove/ })).toBeNull();
	});
});
