import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';

import DamageNodeTestHarness from './DamageNode.testHarness.svelte';

/**
 * The three states a damage node can be rendered in: an ordinary rolled total,
 * a deferred node offering its Roll Damage button, and that same deferred node
 * seen by someone who cannot write to the chat message.
 */

function createMessage(overrides: { canRoll?: boolean } = {}) {
	return {
		id: 'message-1',
		system: { isMiss: false, actorType: 'character', permissions: {} },
		canRollDeferredDamage: () => overrides.canRoll ?? true,
		rollDeferredDamage: vi.fn().mockResolvedValue(undefined),
	};
}

function deferredNode(overrides: Record<string, unknown> = {}) {
	return {
		id: 'trap-damage',
		type: 'damage',
		damageType: 'necrotic',
		formula: '3d12',
		deferredRoll: true,
		...overrides,
	};
}

function rolledRoll(total = 21) {
	return { class: 'Roll', formula: '3d12', total, options: {}, terms: [] };
}

function renderNode(message: ReturnType<typeof createMessage>, node: Record<string, unknown>) {
	return render(DamageNodeTestHarness, { props: { messageDocument: message, node } });
}

function rollDamageButton() {
	return screen.queryByRole('button', { name: /roll damage/i });
}

type GameStub = { settings: unknown };

function gameStub() {
	return game as unknown as GameStub;
}

const rollStub = () => (globalThis as unknown as { Roll: { fromData: unknown } }).Roll;

let previousDamageTypes: unknown;
let previousGameSettings: unknown;
let previousRollFromData: unknown;

beforeEach(() => {
	previousDamageTypes = CONFIG.NIMBLE.damageTypes;
	CONFIG.NIMBLE.damageTypes = {
		necrotic: 'Necrotic',
	} as unknown as typeof CONFIG.NIMBLE.damageTypes;

	// RollSummary reads the auto-expand setting as it mounts.
	previousGameSettings = gameStub().settings;
	gameStub().settings = { get: () => false };

	// The roll tooltip walks `roll.dice`, which the shared Roll mock has no
	// getter for — same stub the ItemCardEffects tests use.
	previousRollFromData = rollStub().fromData;
	rollStub().fromData = (data: Record<string, unknown>) => ({ ...data, dice: [] });
});

afterEach(() => {
	CONFIG.NIMBLE.damageTypes = previousDamageTypes as typeof CONFIG.NIMBLE.damageTypes;
	gameStub().settings = previousGameSettings;
	rollStub().fromData = previousRollFromData;
});

describe('DamageNode', () => {
	it('offers the roll instead of a total while the damage is deferred', () => {
		renderNode(createMessage(), deferredNode());

		expect(rollDamageButton()).not.toBeNull();
		expect(screen.queryByText('21')).toBeNull();
	});

	it('renders nothing at all for a viewer who cannot roll it', () => {
		const { container } = renderNode(createMessage({ canRoll: false }), deferredNode());

		// Not merely a hidden button: a "0 Necrotic" placeholder would read as
		// damage that already resolved, so the node contributes no markup.
		expect(rollDamageButton()).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('shows the rolled total once the node carries a roll', () => {
		renderNode(createMessage(), deferredNode({ roll: rolledRoll() }));

		expect(rollDamageButton()).toBeNull();
		expect(screen.getByText('21')).toBeTruthy();
	});

	it('leaves out the primary-die details for a roll that carries none', () => {
		// A roll written onto the card after the fact serializes `options: {}`.
		// Drawing the block then puts two empty labels under the total.
		renderNode(createMessage(), deferredNode({ roll: rolledRoll() }));

		expect(screen.queryByText(/primary die value/i)).toBeNull();
	});

	it('shows the primary-die details when the roll actually has them', () => {
		renderNode(
			createMessage(),
			deferredNode({
				roll: { ...rolledRoll(), options: { primaryDieValue: 12, primaryDieModifier: 2 } },
			}),
		);

		expect(screen.getByText(/primary die value: 12/i)).toBeTruthy();
		expect(screen.getByText(/primary die modifier: 2/i)).toBeTruthy();
	});

	it('shows the total for ordinary damage that was never deferred', () => {
		renderNode(createMessage(), deferredNode({ deferredRoll: false, roll: rolledRoll(14) }));

		expect(rollDamageButton()).toBeNull();
		expect(screen.getByText('14')).toBeTruthy();
	});

	it('asks the card to roll the node it belongs to', async () => {
		const message = createMessage();
		renderNode(message, deferredNode());

		await fireEvent.click(rollDamageButton()!);

		await waitFor(() => expect(message.rollDeferredDamage).toHaveBeenCalledWith('trap-damage'));
	});

	it('rolls once when the button is double-clicked', async () => {
		const message = createMessage();
		// Hold the first roll open so the second click lands mid-flight, which is
		// the race the in-component guard exists for.
		let releaseRoll: () => void = () => {};
		message.rollDeferredDamage.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseRoll = resolve;
				}),
		);
		renderNode(message, deferredNode());

		const button = rollDamageButton()!;
		await fireEvent.click(button);
		await fireEvent.click(button);
		releaseRoll();

		await waitFor(() => expect(message.rollDeferredDamage).toHaveBeenCalledTimes(1));
	});

	it('tells the user when the roll fails, and lets them try again', async () => {
		const message = createMessage();
		message.rollDeferredDamage.mockRejectedValueOnce(new Error('no permission'));
		renderNode(message, deferredNode());

		await fireEvent.click(rollDamageButton()!);

		await waitFor(() => expect(ui.notifications?.error).toHaveBeenCalled());
		// The guard has to clear or the button stays dead after one failure.
		await waitFor(() => expect(rollDamageButton()?.hasAttribute('disabled')).toBe(false));
	});
});
