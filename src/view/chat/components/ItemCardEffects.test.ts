import { render, screen } from '@testing-library/svelte';
import ItemCardEffectsTestHarness from './ItemCardEffects.testHarness.svelte';

/**
 * Where the Apply Damage control renders. The card-level control covers every
 * packet `applyAllDamage` collects; save-gated damage is excluded from that
 * pass by construction and so keeps a control of its own. Both paths are pure
 * render wiring, invisible to the document-level tests.
 */

function damageRoll(total: number) {
	return {
		class: 'Roll',
		formula: String(total),
		total,
		evaluated: true,
		options: {},
		terms: [{ class: 'NumericTerm', number: total, evaluated: true, options: {} }],
	};
}

function damageNode(id: string, damageType: string, total: number) {
	return {
		id,
		type: 'damage',
		damageType,
		formula: String(total),
		parentNode: null,
		parentContext: null,
		roll: damageRoll(total),
	};
}

function saveGatedDamageNode(id: string, parentNode: string) {
	return {
		id,
		type: 'damage',
		damageType: 'fire',
		formula: '10',
		parentNode,
		parentContext: 'failedSave',
		roll: damageRoll(10),
	};
}

/** `effectNodes` is already grouped by `groupNodes` when the card renders. */
function createMessage(groups: unknown[][], effects: unknown[] = []) {
	const message = {
		id: 'message-1',
		effectNodes: groups,
		system: {
			isMiss: false,
			isCritical: false,
			actorType: 'character',
			permissions: 3,
			activation: { effects },
		},
		canApplyAllDamage: () => true,
		canApplyDamage: () => true,
		applyAllDamage: () => undefined,
		applyDamage: () => undefined,
		reactive: null as unknown,
	};
	message.reactive = message;
	return message;
}

type GameStub = { user: unknown; settings: unknown };
const gameStub = () => (globalThis as unknown as { game: GameStub }).game;
const rollStub = () => (globalThis as unknown as { Roll: { fromData: unknown } }).Roll;

let previousGameUser: unknown;
let previousGameSettings: unknown;
let previousRollFromData: unknown;

beforeEach(() => {
	previousGameUser = gameStub().user;
	previousGameSettings = gameStub().settings;
	previousRollFromData = rollStub().fromData;

	gameStub().user = { isGM: true };
	// RollSummary reads the auto-expand world setting as it renders.
	gameStub().settings = { get: () => false };
	// The roll tooltip walks `roll.dice`, which the shared Roll mock has no
	// notion of. Nothing here asserts on tooltips.
	rollStub().fromData = (data: Record<string, unknown>) => ({ ...data, dice: [] });
	// The button's disposition hint watches controlled tokens on the canvas.
	(globalThis as unknown as { canvas: unknown }).canvas = { tokens: { controlled: [] } };
});

afterEach(() => {
	gameStub().user = previousGameUser;
	gameStub().settings = previousGameSettings;
	rollStub().fromData = previousRollFromData;
	(globalThis as unknown as { canvas: unknown }).canvas = undefined;
});

function applyButtons() {
	return screen.queryAllByRole('button', { name: /apply damage/i });
}

describe('ItemCardEffects apply-damage controls', () => {
	it('renders one control for a card with a single damage packet', () => {
		render(ItemCardEffectsTestHarness, {
			props: { messageDocument: createMessage([[damageNode('a', 'slashing', 8)]]) },
		});

		expect(applyButtons()).toHaveLength(1);
	});

	it('renders one control, not two, for a card with two damage packets', () => {
		render(ItemCardEffectsTestHarness, {
			props: {
				messageDocument: createMessage([
					[damageNode('a', 'slashing', 8), damageNode('b', 'radiant', 5)],
				]),
			},
		});

		expect(applyButtons()).toHaveLength(1);
	});

	it('renders no control for a card with no damage at all', () => {
		render(ItemCardEffectsTestHarness, {
			props: {
				messageDocument: createMessage([
					[{ id: 'n', type: 'note', noteType: 'general', text: 'Hello', parentNode: null }],
				]),
			},
		});

		expect(applyButtons()).toHaveLength(0);
	});

	it('renders a control for save-gated damage, which the card-level pass excludes', () => {
		const save = {
			id: 'save',
			type: 'savingThrow',
			savingThrowType: 'strength',
			saveType: 'strength',
			parentNode: null,
			parentContext: null,
			on: { failedSave: [saveGatedDamageNode('save-damage', 'save')] },
			sharedRolls: [],
		};

		render(ItemCardEffectsTestHarness, {
			props: { messageDocument: createMessage([[save]], [save]), effects: [save] },
		});

		expect(applyButtons()).toHaveLength(1);
	});

	it('renders nothing for a player, who cannot apply damage', () => {
		gameStub().user = { isGM: false };

		render(ItemCardEffectsTestHarness, {
			props: { messageDocument: createMessage([[damageNode('a', 'slashing', 8)]]) },
		});

		expect(applyButtons()).toHaveLength(0);
	});
});
