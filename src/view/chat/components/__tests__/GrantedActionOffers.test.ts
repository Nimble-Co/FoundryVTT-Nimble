import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import GrantedActionOffersTestHarness from './GrantedActionOffers.testHarness.svelte';

interface OfferOptions {
	id?: string;
	label?: string;
	used?: boolean;
	sourceItemUuid?: string;
	free?: boolean;
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
		ruleId: 'rule-1',
		sourceItemUuid: options.sourceItemUuid ?? '',
		free: options.free ?? false,
		spendsReaction: false,
		weaponKind: options.weaponKind ?? 'any',
		allowsCantrips: options.allowsCantrips ?? false,
		ignoresRushed: options.ignoresRushed ?? false,
		condition: options.condition ?? '',
		targetCount: options.targetCount ?? 0,
		targetedCount: options.targetedCount ?? 0,
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

function createTargetToken(actorId: string, actorName: string, disposition = -1) {
	return { actor: { id: actorId, name: actorName }, document: { disposition } };
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
	it('shows the label as text, and the dropdown and the Attack button at once', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(screen.getByText('Sir Brannon: Weapon Attack (Granting Feature)')).toBeTruthy();
		expect(dropdown().value).toBe('Actor.ally.Item.sword');
		expect(attackButton().disabled).toBe(false);
	});

	it('leaves the source out of the label when the line has none', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([{ ...createOffer(), label: '' }]) },
		});

		expect(screen.getByText('Sir Brannon: Weapon Attack')).toBeTruthy();
	});

	it('names an unarmed line an Unarmed Strike', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ weaponKind: 'unarmed' })]) },
		});

		expect(screen.getByText('Sir Brannon: Unarmed Strike (Granting Feature)')).toBeTruthy();
	});

	it('shows the condition of the line under its label', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ condition: 'If you end adjacent to your quarry.' }),
				]),
			},
		});

		expect(screen.getByText('If you end adjacent to your quarry.')).toBeTruthy();
	});

	it('shows the extra targets the recipient can attack, which share one attack', () => {
		const extra = (source: string, reach: number) => ({
			type: 'extraTargets',
			extraTargetsFor: (origin: string) =>
				origin === 'flurry' ? { source, count: 1, reach } : null,
		});
		const g = globalThis as Record<string, any>;
		g.fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Item.flurry'
				? { system: { identifier: 'flurry' } }
				: { ...createRecipient(), rules: [extra('Wide Reach', 2), extra('Wider Reach', 0)] },
		);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ sourceItemUuid: 'Item.flurry' })]) },
		});

		expect(
			screen.getByText(
				'Up to 3 targets share one attack: 1 more within Reach 2 (Wide Reach), 1 more (Wider Reach).',
			),
		).toBeTruthy();
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

	it('attacks with the chosen weapon through the granting feature', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() =>
			createRecipient({
				activateItem,
				items: [weapon('sword', 'Longsword'), weapon('axe', 'Handaxe')],
			}),
		);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ sourceItemUuid: 'Item.source' })]) },
		});

		await fireEvent.change(dropdown(), { target: { value: 'Actor.ally.Item.axe' } });
		await fireEvent.click(attackButton());

		expect(activateItem).toHaveBeenCalledWith('axe', { originUuid: 'Item.source' });
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

	it('renders an attribution line instead of the controls for used lines', () => {
		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer({ used: true })]) },
		});

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('combobox')).toBeNull();
		expect(screen.getByText(/Granted action used by Sir Brannon/)).toBeTruthy();
	});

	it('renders nothing when there are no lines', () => {
		const { container } = render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([]) },
		});

		expect(container.querySelector('section')).toBeNull();
	});

	it('names the recipient in a notice while they are the current target, and still attacks', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() => createRecipient({ activateItem }));
		g.game.user.targets = new Set([createTargetToken('ally', 'Sir Brannon')]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(
			screen.getByText(/Currently targeting Sir Brannon, who is the one taking this action/),
		).toBeTruthy();

		await fireEvent.click(attackButton());
		expect(activateItem).toHaveBeenCalledWith('sword', { originUuid: '' });
	});

	it('names only the recipient as the one acting when other creatures are targeted too', () => {
		const g = globalThis as Record<string, any>;
		g.game.user.targets = new Set([
			createTargetToken('ally', 'Sir Brannon'),
			createTargetToken('goblin', 'Goblin Cutthroat'),
		]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		// The clause claims its subject is the one acting, so naming anyone but
		// the recipient in it states something false.
		const notice = screen.getByText(
			/Currently targeting Sir Brannon, who is the one taking this action/,
		);
		expect(notice.textContent).not.toContain('Goblin Cutthroat');
		expect(screen.getByText(/Target: Goblin Cutthroat/)).toBeTruthy();
	});

	it('leaves every line usable whoever is targeted, friendly included', async () => {
		const g = globalThis as Record<string, any>;
		const activateItem = vi.fn(async () => ({}));
		g.fromUuidSync = vi.fn(() => createRecipient({ activateItem }));
		g.game.user.targets = new Set([createTargetToken('cleric', 'Sister Mila', 1)]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		// Who to aim at is the table's call. The card reports the target and
		// nothing more: no disabling, and no styling that reads as disabled.
		expect(attackButton().disabled).toBe(false);
		expect(attackButton().className).not.toMatch(/discouraged/);

		await fireEvent.click(attackButton());
		expect(activateItem).toHaveBeenCalledWith('sword', { originUuid: '' });
	});

	it('updates the notice as soon as the user retargets', async () => {
		const g = globalThis as Record<string, any>;
		g.game.user.targets = new Set([createTargetToken('ally', 'Sir Brannon')]);

		render(GrantedActionOffersTestHarness, {
			props: { messageDocument: createMessage([createOffer()]) },
		});

		expect(screen.getByText(/Currently targeting Sir Brannon/)).toBeTruthy();

		const targetTokenHook = (g.Hooks.on as ReturnType<typeof vi.fn>).mock.calls.findLast(
			(call: unknown[]) => call[0] === 'targetToken',
		);
		expect(targetTokenHook).toBeTruthy();

		g.game.user.targets = new Set([createTargetToken('goblin', 'Goblin Cutthroat')]);
		(targetTokenHook?.[1] as () => void)();
		await tick();

		expect(screen.queryByText(/Currently targeting Sir Brannon/)).toBeNull();
		expect(screen.getByText(/Goblin Cutthroat/)).toBeTruthy();
		expect(attackButton().disabled).toBe(false);
	});

	it('warns once when more creatures are targeted than the rule reaches, and leaves every line usable', () => {
		const over = { label: 'Coordinated Strike', targetCount: 1, targetedCount: 2 };
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ ...over, id: 'offer-1', targetActorUuid: 'Actor.ally' }),
					createOffer({ ...over, id: 'offer-2', targetActorUuid: 'Actor.other' }),
				]),
			},
		});

		expect(
			screen.getAllByText('Coordinated Strike reaches 1 creature. 2 are targeted.'),
		).toHaveLength(1);
		const buttons = screen.getAllByRole('button', { name: /Attack/ }) as HTMLButtonElement[];
		expect(buttons.map((button) => button.disabled)).toEqual([false, false]);
	});

	it('gives no warning while the targets fit the count, or when the rule has none', () => {
		render(GrantedActionOffersTestHarness, {
			props: {
				messageDocument: createMessage([
					createOffer({ id: 'offer-1', targetCount: 2, targetedCount: 2 }),
					createOffer({ id: 'offer-2', ruleId: 'rule-2', targetedCount: 3 } as never),
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
	});
});
