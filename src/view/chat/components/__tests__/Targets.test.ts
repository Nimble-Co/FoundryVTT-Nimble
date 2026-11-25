import { render, screen } from '@testing-library/svelte';
import { SYSTEM_ID } from '#system';
import { appliedDamageTip } from '../Targets.svelte.ts';
import TargetsTestHarness from './Targets.testHarness.svelte';

const baseGame = game;

const GOBLIN_TOKEN = 'Scene.s1.Token.tok1';
const ARCHER_TOKEN = 'Scene.s1.Token.tok2';

function createToken(uuid: string, name: string) {
	return {
		uuid,
		name,
		texture: { src: `${name}.webp` },
		actor: { name, type: 'character', system: { attributes: { armor: null } } },
		object: null,
	};
}

const TOKENS: Record<string, ReturnType<typeof createToken>> = {
	[GOBLIN_TOKEN]: createToken(GOBLIN_TOKEN, 'Goblin Cutthroat'),
	[ARCHER_TOKEN]: createToken(ARCHER_TOKEN, 'Goblin Archer'),
};

function createMessage() {
	const system = {
		actorName: 'Sir Brannon',
		targets: [GOBLIN_TOKEN, ARCHER_TOKEN],
		activation: {
			effects: [
				{
					id: 'node1',
					type: 'move',
					kind: 'forced',
					recipient: 'targets',
					distance: '2',
					distanceBySize: {},
					ignoreDifficultTerrain: true,
					direction: 'away',
					parentContext: null,
					parentNode: null,
				},
			],
		},
		movementOffers: [
			{
				id: 'node1.tok1',
				nodeId: 'node1',
				tokenUuid: GOBLIN_TOKEN,
				name: 'Goblin Cutthroat',
				kind: 'forced',
				spaces: 2,
				ignoreDifficultTerrain: true,
				state: 'taken',
				usedBy: 'player',
				movedSpaces: 2,
				stopped: false,
				conditional: false,
			},
		],
	};
	const message = {
		id: 'msg1',
		speaker: { scene: 's1', token: 'hero', actor: 'a1' },
		system,
		getDamageBreakdownForTarget: () => null,
	};
	return { ...message, reactive: message };
}

beforeEach(() => {
	vi.stubGlobal('game', { ...baseGame, settings: { get: vi.fn(() => true) } });
	vi.stubGlobal(
		'fromUuid',
		vi.fn(async (uuid: string) => TOKENS[uuid] ?? null),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Targets', () => {
	it('shows the movement chip on the row of the creature that moved', async () => {
		const { container } = render(TargetsTestHarness, {
			props: { messageDocument: createMessage() },
		});

		const chip = await screen.findByRole('img', { name: 'Pushed the full 2 spaces.' });
		expect(chip.textContent?.trim()).toBe('2/2');
		expect(chip.dataset.status).toBe('taken');

		const rows = [...container.querySelectorAll<HTMLElement>('.nimble-target-list > li')];
		const goblinRow = rows.find((row) => row.textContent?.includes('Goblin Cutthroat'));
		const archerRow = rows.find((row) => row.textContent?.includes('Goblin Archer'));
		expect(goblinRow?.contains(chip)).toBe(true);
		expect(goblinRow?.classList.contains('nimble-target--moves')).toBe(true);
		expect(archerRow?.querySelector('.nimble-movement-chip')).toBeNull();
		expect(archerRow?.classList.contains('nimble-target--moves')).toBe(false);
	});

	it('shows that a target takes no damage, for that target only and for every user', async () => {
		const message = createMessage();
		Object.assign(message.reactive, {
			noDamageSourceFor: (uuid: string) => (uuid === GOBLIN_TOKEN ? 'Epic Resistance' : null),
		});
		const { container } = render(TargetsTestHarness, { props: { messageDocument: message } });
		await vi.waitFor(() => {
			expect(container.querySelectorAll('.nimble-card').length).toBe(2);
		});
		const badges = container.querySelectorAll('[data-badge-kind="noDamage"]');
		expect(badges.length).toBe(1);
		expect(badges[0].textContent?.trim()).toBe('No Damage');
		expect(badges[0].getAttribute('data-tooltip')).toContain('Epic Resistance');
		expect(badges[0].closest('.nimble-card')?.textContent).toContain('Goblin Cutthroat');
	});

	it('lists a creature this card marked that is not a target, with only its Marked button', async () => {
		const BOAR_TOKEN = 'Scene.s1.Token.boar';
		const hunter = {
			getFlag: () => ({
				quarry: [
					{ actorUuid: 'Actor.goblin', tokenUuid: GOBLIN_TOKEN, name: 'Goblin Cutthroat' },
					{ actorUuid: 'Actor.boar', tokenUuid: BOAR_TOKEN, name: 'Boar', cardId: 'msg1' },
					{ actorUuid: 'Actor.ogre', tokenUuid: null, name: 'Ogre', cardId: 'msg0' },
				],
			}),
		};
		const item = {
			uuid: 'Actor.a1.Item.mark',
			name: 'Mark Quarry',
			actor: hunter,
			rules: new Map([['r', { type: 'markTarget', flagKey: 'quarry' }]]),
		};
		const message = Object.assign(createMessage(), {
			flags: { [SYSTEM_ID]: { itemId: 'mark' } },
			speakerActor: { isOwner: true, items: { get: () => item } },
		});
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === BOAR_TOKEN ? { uuid, texture: { src: 'boar.webp' }, object: null } : null,
			),
		);

		const { container } = render(TargetsTestHarness, { props: { messageDocument: message } });

		await vi.waitFor(() => {
			expect(container.querySelectorAll('.nimble-target-list > li').length).toBe(3);
		});
		const rows = [...container.querySelectorAll<HTMLElement>('.nimble-target-list > li')];
		const boarRow = rows.find((row) => row.textContent?.includes('Boar'));
		expect(boarRow?.querySelector('.nimble-target-mark')?.textContent).toContain('Marked');
		expect(boarRow?.querySelector('[aria-label="Remove Target"]')).toBeNull();
		expect(boarRow?.querySelector('img')?.getAttribute('src')).toBe('boar.webp');
		expect(rows.some((row) => row.textContent?.includes('Ogre'))).toBe(false);
	});

	it('shows the GM the live preview until damage is applied', async () => {
		vi.stubGlobal('game', {
			...baseGame,
			user: { ...baseGame.user, isGM: true },
			settings: { get: vi.fn(() => true) },
		});
		const message = createMessage();
		Object.assign(message.reactive, {
			getDamageBreakdownForTarget: () => ({ total: 9, components: [] }),
		});
		const { container } = render(TargetsTestHarness, { props: { messageDocument: message } });
		await vi.waitFor(() => {
			expect(container.querySelectorAll('.nimble-card').length).toBe(2);
		});

		expect(container.querySelector('[data-damage-state="applied"]')).toBeNull();
		expect(container.textContent).toContain('(9)');
	});

	it('shows a recorded amount, including 0, to a player and hides the live preview', async () => {
		vi.stubGlobal('game', {
			...baseGame,
			user: { ...baseGame.user, isGM: false },
			settings: { get: vi.fn(() => true) },
		});
		const message = createMessage();
		Object.assign(message.reactive, {
			appliedDamageFor: (uuid: string) =>
				uuid === GOBLIN_TOKEN
					? {
							uuid,
							tokenName: 'Goblin Cutthroat',
							amount: 0,
							previousHp: 12,
							newHp: 12,
							previousTempHp: 0,
							newTempHp: 0,
						}
					: null,
			getDamageBreakdownForTarget: () => ({ total: 9, components: [] }),
			noDamageSourceFor: () => 'Epic Resistance',
		});
		const { container } = render(TargetsTestHarness, { props: { messageDocument: message } });
		await vi.waitFor(() => {
			expect(container.querySelectorAll('.nimble-card').length).toBe(2);
		});

		const applied = container.querySelector('[data-damage-state="applied"]');
		expect(applied?.textContent).toContain('0');
		expect(applied?.classList.contains('nimble-target-damage--applied')).toBe(true);
		expect(applied?.getAttribute('data-tooltip')).toBe('Applied 0: HP 12 → 12');
		const goblin = applied?.closest('.nimble-card');
		expect(goblin?.textContent).toContain('Goblin Cutthroat');
		expect(goblin?.querySelector('[data-badge-kind="noDamage"]')).toBeNull();
		expect(container.textContent).not.toContain('(9)');
		const archer = [...container.querySelectorAll('.nimble-card')].find((row) =>
			row.textContent?.includes('Goblin Archer'),
		);
		expect(archer?.querySelector('[data-damage-state="applied"]')).toBeNull();
	});

	it('names the temp HP in the tooltip when the hit took some', () => {
		const tip = appliedDamageTip({
			uuid: GOBLIN_TOKEN,
			tokenName: 'Goblin Cutthroat',
			amount: 5,
			previousHp: 10,
			newHp: 8,
			previousTempHp: 3,
			newTempHp: 0,
		});

		expect(tip).toBe('Applied 5: HP 10 → 8, temp HP 3 → 0');
	});
});
