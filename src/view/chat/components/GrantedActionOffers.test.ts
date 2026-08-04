import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import GrantedActionOffersTestHarness from './GrantedActionOffers.testHarness.svelte';

interface OfferOptions {
	id?: string;
	label?: string;
	used?: boolean;
}

function createOffer(options: OfferOptions = {}) {
	return {
		id: options.id ?? 'offer-1',
		targetActorUuid: 'Actor.ally',
		label: options.label ?? 'Granting Feature',
		activationType: 'weaponAttack',
		ruleId: 'rule-1',
		sourceItemUuid: '',
		used: options.used ?? false,
		usedBy: options.used ? 'player-1' : null,
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

function createRecipient(options: { activateItem?: (id: string) => Promise<unknown> } = {}) {
	return {
		id: 'ally',
		name: 'Sir Brannon',
		isOwner: true,
		items: [{ id: 'sword', name: 'Longsword', type: 'object', system: { objectType: 'weapon' } }],
		activateItem: options.activateItem,
	};
}

function createTargetToken(actorId: string, actorName: string) {
	return { actor: { id: actorId, name: actorName }, document: { disposition: -1 } };
}

let previousFromUuidSync: unknown;
let previousGameUser: unknown;

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: true, items: [] }));
	g.game = g.game ?? {};
	g.game.user = { isGM: true, id: 'gm', targets: new Set() };
});

afterEach(() => {
	const g = globalThis as Record<string, any>;
	g.fromUuidSync = previousFromUuidSync;
	if (g.game) g.game.user = previousGameUser;
});

describe('GrantedActionOffers', () => {
	it('renders a labeled button for a pending offer', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		const button = screen.getByRole('button');
		expect(button.textContent).toContain('Weapon Attack');
		expect(button.textContent).toContain('Granting Feature');
		expect(button.textContent).toContain('Sir Brannon');
	});

	it('expands into the recipient item list on click, with an empty state when no items qualify', async () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		await fireEvent.click(screen.getByRole('button'));

		expect(screen.getByText('No eligible items to use.')).toBeTruthy();
	});

	it('lists the recipient weapons when the offer is expanded', async () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() => ({
			name: 'Sir Brannon',
			isOwner: true,
			items: [
				{ id: 'sword', name: 'Longsword', type: 'object', system: { objectType: 'weapon' } },
				{ id: 'rope', name: 'Rope', type: 'object', system: { objectType: 'gear' } },
				{ id: 'rage', name: 'Rage', type: 'feature', system: {} },
			],
		}));

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		await fireEvent.click(screen.getByRole('button'));

		const buttons = screen.getAllByRole('button');
		const buttonLabels = buttons.map((button) => button.textContent ?? '');
		expect(buttonLabels.some((label) => label.includes('Longsword'))).toBe(true);
		expect(buttonLabels.some((label) => label.includes('Rope'))).toBe(false);
		expect(buttonLabels.some((label) => label.includes('Rage'))).toBe(false);
	});

	it('renders an attribution line instead of a button for used offers', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ used: true })]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText(/Sir Brannon/)).toBeTruthy();
	});

	it('renders nothing when there are no offers', () => {
		const { container } = render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([]) },
		});

		expect(container.querySelector('section')).toBeNull();
	});

	it('blocks the offer while the recipient is the current target', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() => createRecipient({ activateItem }));
		g.game.user.targets = new Set([createTargetToken('ally', 'Sir Brannon')]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		await fireEvent.click(screen.getByRole('button'));

		const itemButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.includes('Longsword'));
		expect(itemButton).toBeTruthy();
		expect((itemButton as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText(/You are targeting Sir Brannon/)).toBeTruthy();

		await fireEvent.click(itemButton as HTMLButtonElement);
		expect(activateItem).not.toHaveBeenCalled();
	});

	it('names the current target when the offer is usable', async () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() => createRecipient());
		g.game.user.targets = new Set([createTargetToken('goblin', 'Goblin Cutthroat')]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		await fireEvent.click(screen.getByRole('button'));

		const itemButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.includes('Longsword'));
		expect((itemButton as HTMLButtonElement).disabled).toBe(false);
		expect(screen.getByText(/Goblin Cutthroat/)).toBeTruthy();
	});

	it('unblocks as soon as the user retargets', async () => {
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn(() => createRecipient());
		g.game.user.targets = new Set([createTargetToken('ally', 'Sir Brannon')]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		await fireEvent.click(screen.getByRole('button'));

		const targetTokenHook = (g.Hooks.on as ReturnType<typeof vi.fn>).mock.calls.findLast(
			(call: unknown[]) => call[0] === 'targetToken',
		);
		expect(targetTokenHook).toBeTruthy();

		g.game.user.targets = new Set([createTargetToken('goblin', 'Goblin Cutthroat')]);
		(targetTokenHook?.[1] as () => void)();
		await tick();

		const itemButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.includes('Longsword'));
		expect((itemButton as HTMLButtonElement).disabled).toBe(false);
	});

	it('hides pending offers from non-owners who are not GMs', () => {
		const g = globalThis as Record<string, any>;
		g.game.user = { isGM: false, id: 'player' };
		g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: false, items: [] }));

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
	});
});
