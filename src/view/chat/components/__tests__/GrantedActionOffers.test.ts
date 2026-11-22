import { fireEvent, render, screen } from '@testing-library/svelte';
import GrantedActionOffersTestHarness from './GrantedActionOffers.testHarness.svelte';

interface OfferOptions {
	id?: string;
	label?: string;
	used?: boolean;
	sourceItemUuid?: string;
	free?: boolean;
	spendsReaction?: boolean;
	ruleId?: string;
	usedWith?: { name: string; uuid: string } | null;
	weaponKind?: string;
	allowsCantrips?: boolean;
	ignoresRushed?: boolean;
	condition?: string;
	targetActorUuid?: string;
	targetCount?: number;
	targetedCount?: number;
}

function createOffer(options: OfferOptions = {}) {
	return {
		id: options.id ?? 'offer-1',
		targetActorUuid: options.targetActorUuid ?? 'Actor.ally',
		label: options.label ?? 'Granting Feature',
		activationType: 'weaponAttack',
		ruleId: options.ruleId ?? 'rule-1',
		sourceItemUuid: options.sourceItemUuid ?? '',
		free: options.free ?? false,
		spendsReaction: options.spendsReaction ?? false,
		weaponKind: options.weaponKind ?? 'any',
		allowsCantrips: options.allowsCantrips ?? false,
		ignoresRushed: options.ignoresRushed ?? false,
		condition: options.condition ?? '',
		targetCount: options.targetCount ?? 0,
		targetedCount: options.targetedCount ?? 0,
		used: options.used ?? false,
		usedBy: options.used ? 'player-1' : null,
		usedWith: options.usedWith ?? null,
	};
}

function createMessage(offers: ReturnType<typeof createOffer>[]) {
	const message = {
		id: 'message-1',
		system: { grantedActionOffers: offers },
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

function weapon(id: string, name: string, equipped = true) {
	return {
		id,
		uuid: `Actor.ally.Item.${id}`,
		name,
		type: 'object',
		system: {
			objectType: 'weapon',
			equipped,
			activation: {
				targets: { attackType: 'reach', distance: 1 },
				effects: [{ type: 'damage', formula: '1d8', damageType: 'slashing' }],
			},
		},
	};
}

function createRecipient(
	options: {
		activateItem?: (id: string, options?: unknown) => Promise<unknown>;
		items?: unknown[];
	} = {},
) {
	return {
		id: 'ally',
		name: 'Sir Brannon',
		isOwner: true,
		system: {},
		items: options.items ?? [weapon('sword', 'Longsword')],
		activateItem: options.activateItem,
	};
}

const attackButton = () => screen.getByRole('button', { name: /Attack/ }) as HTMLButtonElement;
const dropdown = () => screen.getByRole('combobox') as HTMLSelectElement;
const optionNames = () =>
	Array.from(dropdown().querySelectorAll('option'), (option) => option.textContent?.trim());
const groupNames = () =>
	Array.from(dropdown().querySelectorAll('optgroup'), (group) => group.getAttribute('label'));

let previousFromUuidSync: unknown;
let previousGameUser: unknown;

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	g.fromUuidSync = vi.fn(() => createRecipient());
	g.game = g.game ?? {};
	g.game.user = { isGM: true, id: 'gm', targets: new Set() };
});

afterEach(() => {
	const g = globalThis as Record<string, any>;
	g.fromUuidSync = previousFromUuidSync;
	if (g.game) g.game.user = previousGameUser;
});

describe('GrantedActionOffers', () => {
	it('heads the section with what the line gives, then the creature and its controls', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ free: true })]) },
		});

		expect(screen.getByRole('heading', { name: 'Free Attack' })).toBeTruthy();
		expect(screen.getByText('Sir Brannon')).toBeTruthy();
		expect(dropdown().value).toBe('Actor.ally.Item.sword');
		expect(attackButton().disabled).toBe(false);
	});

	it('names a line that spends an action or the reaction in its heading', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ id: 'offer-1' }),
					createOffer({ id: 'offer-2', spendsReaction: true }),
				]),
			},
		});

		expect(screen.getByRole('heading', { name: 'Attack (1 action)' })).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Opportunity Attack (reaction)' })).toBeTruthy();
	});

	it('keeps one Free Attack heading when cantrips are in the dropdown', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([createOffer({ free: true, allowsCantrips: true })]),
			},
		});

		expect(screen.getAllByRole('heading').map((heading) => heading.textContent?.trim())).toEqual([
			'Free Attack',
		]);
	});

	it('puts the feature and the condition in the name tooltip, not on the line', () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Item.control' ? { name: 'Control' } : createRecipient(),
		);

		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({
						sourceItemUuid: 'Item.control',
						condition: 'If you passed the save, attack with disadvantage.',
					}),
				]),
			},
		});

		expect(screen.queryByText('If you passed the save, attack with disadvantage.')).toBeNull();
		expect(screen.getByText('Sir Brannon').closest('p')?.dataset.tooltipText).toBe(
			'Control: If you passed the save, attack with disadvantage.',
		);
	});

	it('puts the extra targets that share one attack in the name tooltip', () => {
		const extra = (source: string, reach: number) => ({
			type: 'extraTargets',
			extraTargetsFor: (origin: string) =>
				origin === 'flurry' ? { source, count: 1, reach } : null,
		});
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Item.flurry'
				? { name: 'Flurry', system: { identifier: 'flurry' } }
				: { ...createRecipient(), rules: [extra('Wide Reach', 2), extra('Wider Reach', 0)] },
		);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ sourceItemUuid: 'Item.flurry' })]) },
		});

		expect(screen.getByText('Sir Brannon').closest('p')?.dataset.tooltipText).toBe(
			'Flurry: Up to 3 targets share one attack: 1 more within Reach 2 (Wide Reach), 1 more (Wider Reach).',
		);
	});

	it('says so when the recipient has nothing to attack with', () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() => createRecipient({ items: [] }));

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ weaponKind: 'ranged' })]) },
		});

		expect(screen.getByText('No weapon to attack with.')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('groups the weapons only when some are equipped and some are not, first equipped chosen', () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() =>
			createRecipient({
				items: [
					weapon('bow', 'Shortbow', false),
					weapon('sword', 'Longsword'),
					{ id: 'rope', name: 'Rope', type: 'object', system: { objectType: 'gear' } },
				],
			}),
		);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(groupNames()).toEqual(['Equipped', 'Not equipped']);
		expect(optionNames()).toEqual(['Longsword', 'Shortbow']);
		expect(dropdown().value).toBe('Actor.ally.Item.sword');
	});

	it('adds a Cantrips group when the line allows cantrips', () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() =>
			createRecipient({
				items: [
					weapon('sword', 'Longsword'),
					{
						id: 'bolt',
						uuid: 'Actor.ally.Item.bolt',
						name: 'Fire Bolt',
						type: 'spell',
						system: { tier: 0 },
					},
				],
			}),
		);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ allowsCantrips: true })]) },
		});

		expect(groupNames()).toEqual(['Cantrips']);
		expect(optionNames()).toEqual(['Longsword', 'Fire Bolt']);
	});

	it('attacks with the chosen weapon through the granting feature, and keeps the weapon on the line', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() =>
			createRecipient({
				activateItem,
				items: [weapon('sword', 'Longsword'), weapon('axe', 'Handaxe')],
			}),
		);
		const message = createMessage([createOffer()]);
		const update = vi.fn(async () => undefined);
		Object.assign(message, { update });
		const previous = { messages: g.game.messages, users: g.game.users };
		g.game.messages = { get: () => message };
		g.game.users = { get: () => ({ id: 'gm', isGM: true }) };
		onTestFinished(() => Object.assign(g.game, previous));

		render(GrantedActionOffersTestHarness, { props: { messageDocument: message } });

		await fireEvent.change(dropdown(), { target: { value: 'Actor.ally.Item.axe' } });
		await fireEvent.click(attackButton());

		expect(activateItem).toHaveBeenCalledWith('axe', { originUuid: '' });
		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith({
				system: {
					grantedActionOffers: [
						expect.objectContaining({
							used: true,
							usedWith: { name: 'Handaxe', uuid: 'Actor.ally.Item.axe' },
						}),
					],
				},
			}),
		);
	});

	it('makes a free attack that ignores Rushed Attacks when the line says so', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() => createRecipient({ activateItem }));

		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ sourceItemUuid: 'Item.source', free: true, ignoresRushed: true }),
				]),
			},
		});

		await fireEvent.click(attackButton());

		expect(activateItem).toHaveBeenCalledWith('sword', {
			originUuid: 'Item.source',
			skipActionDeduction: true,
			ignoresRushed: true,
		});
	});

	it('replaces a used line with what the creature attacked with, and keeps the heading', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ used: true, usedWith: { name: 'Longsword', uuid: '' } }),
				]),
			},
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.getByRole('heading', { name: 'Attack (1 action)' })).toBeTruthy();
		expect(screen.getByText('Sir Brannon attacked with Longsword.')).toBeTruthy();
	});

	it('says only who attacked on a card from before the weapon was kept', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ used: true })]) },
		});

		expect(screen.getByText('Sir Brannon attacked.')).toBeTruthy();
	});

	it('renders nothing when there are no lines', () => {
		const { container } = render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([]) },
		});

		expect(container.querySelector('section')).toBeNull();
	});

	it('shows no note about the targets of the user who looks at the card', () => {
		const g = globalThis as Record<string, any>;
		g.game.user.targets = new Set([{ actor: { id: 'goblin', name: 'Goblin Cutthroat' } }]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(screen.queryByText(/Goblin Cutthroat/)).toBeNull();
		expect(screen.queryByText(/targeting/i)).toBeNull();
	});

	it('warns once, naming who is targeted, when more creatures are targeted than the rule reaches', () => {
		const g = globalThis as Record<string, any>;
		const names: Record<string, string> = {
			'Actor.commander': 'Cora',
			'Actor.bram': 'Bram',
			'Actor.pell': 'Pell',
		};
		g.fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.commander.Item.strike'
				? { name: 'Coordinated Strike!' }
				: { ...createRecipient(), name: names[uuid] },
		);
		const over = {
			label: 'Coordinated Strike',
			sourceItemUuid: 'Actor.commander.Item.strike',
			free: true,
			targetCount: 1,
			targetedCount: 2,
		};

		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ ...over, id: 'offer-0', targetActorUuid: 'Actor.commander' }),
					createOffer({ ...over, id: 'offer-1', targetActorUuid: 'Actor.bram' }),
					createOffer({ ...over, id: 'offer-2', targetActorUuid: 'Actor.pell' }),
				]),
			},
		});

		expect(
			screen.getAllByText('Coordinated Strike! reaches 1 creature. Bram and Pell are targeted.'),
		).toHaveLength(1);
		const buttons = screen.getAllByRole('button', { name: /Attack/ }) as HTMLButtonElement[];
		expect(buttons.map((button) => button.disabled)).toEqual([false, false, false]);
	});

	it('gives no warning while the targets fit the count, or when the rule has none', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ id: 'offer-1', targetCount: 2, targetedCount: 2 }),
					createOffer({ id: 'offer-2', ruleId: 'rule-2', targetedCount: 3 }),
				]),
			},
		});

		expect(screen.queryByText(/are targeted/)).toBeNull();
	});

	it('drops the warning once every line of the section is used', () => {
		const over = { targetCount: 1, targetedCount: 2, used: true };
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ ...over, id: 'offer-1' }),
					createOffer({ ...over, id: 'offer-2', targetActorUuid: 'Actor.other' }),
				]),
			},
		});

		expect(screen.queryByText(/are targeted/)).toBeNull();
	});

	it('hides pending lines from non-owners who are not GMs', () => {
		const g = globalThis as Record<string, any>;
		g.game.user = { isGM: false, id: 'player' };
		g.fromUuidSync = vi.fn(() => ({ ...createRecipient(), isOwner: false }));

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.queryByRole('heading')).toBeNull();
	});
});
