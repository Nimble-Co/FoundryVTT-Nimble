import { fireEvent, render, screen } from '@testing-library/svelte';
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

let previousFromUuidSync: unknown;
let previousGameUser: unknown;

beforeEach(() => {
	const g = globalThis as Record<string, any>;
	previousFromUuidSync = g.fromUuidSync;
	previousGameUser = g.game?.user;
	g.fromUuidSync = vi.fn(() => ({ name: 'Sir Brannon', isOwner: true, items: [] }));
	g.game = g.game ?? {};
	g.game.user = { isGM: true, id: 'gm' };
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
