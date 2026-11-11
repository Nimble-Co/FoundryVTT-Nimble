import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetHeroicGlobals } from '../../../../../tests/fixtures/heroicActions.js';
import type { NimbleCharacter } from '../../../../documents/actor/character.js';

const fireAttackEventsMock = vi.fn();
const dialogMock = vi.fn();
const damageRollMock = vi.fn();

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let createOpportunityAttackPanelState: typeof import('../OpportunityAttackPanel.svelte.js').createOpportunityAttackPanelState;

beforeAll(async () => {
	// The fresh import must share this file's Svelte runtime, or `$effect.root` does not hold it.
	const svelteRuntime = await import('svelte/internal/client');
	vi.resetModules();
	vi.doMock('svelte/internal/client', () => svelteRuntime);
	vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', () => ({ fireAttackEvents: fireAttackEventsMock }));
	vi.doMock('#utils/rolls/endUsedConditions.js', () => ({ endUsedConditions: vi.fn() }));
	vi.doMock('../../../../dice/DamageRoll.js', () => ({ DamageRoll: damageRollMock }));
	vi.doMock('../../../../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
		default: dialogMock,
	}));
	vi.doMock('../../../../utils/damage/attackUtils.js', () => ({
		getUnarmedDamageFormula: () => '1',
		hasUnarmedProficiency: () => false,
	}));
	({ createOpportunityAttackPanelState } = await import('../OpportunityAttackPanel.svelte.js'));
});

let restore: () => void;

beforeEach(() => {
	restore = resetHeroicGlobals();
	// Foundry adds `map` to a Set.
	game.user.targets = Object.assign(new Set(), { map: () => [] }) as never;
	fireAttackEventsMock.mockClear();
	dialogMock.mockReset();
	damageRollMock.mockReset();
	damageRollMock.mockImplementation(function roll() {
		return { evaluate: vi.fn(), toJSON: () => ({}), isCritical: false, isMiss: false };
	});
});

afterEach(() => {
	restore();
});

function dialogResult(result: unknown) {
	dialogMock.mockImplementation(function dialog() {
		return { render: vi.fn(), promise: Promise.resolve(result) };
	});
}

function panelFor(actor: object, onUseReaction = vi.fn().mockResolvedValue(true)) {
	let panel!: ReturnType<typeof createOpportunityAttackPanelState>;
	const stop = $effect.root(() => {
		panel = createOpportunityAttackPanelState(
			() => actor as NimbleCharacter,
			() => false,
			() => false,
			() => false,
			() => false,
			() => onUseReaction,
			() => false,
			() => () => {},
		);
	});
	return { panel, stop };
}

function striker() {
	return {
		id: 'striker',
		name: 'Striker',
		type: 'character',
		getRollData: () => ({}),
		reactive: { items: [] },
	};
}

describe('OpportunityAttackPanel unarmed strike', () => {
	it('fires the attack event for the striker once', async () => {
		dialogResult({ rollMode: -1 });
		const actor = striker();
		const { panel, stop } = panelFor(actor);

		await panel.handleUnarmedStrike();
		stop();

		expect(ChatMessage.create).toHaveBeenCalledTimes(1);
		expect(fireAttackEventsMock).toHaveBeenCalledTimes(1);
		expect(fireAttackEventsMock).toHaveBeenCalledWith(actor);
	});

	it('fires nothing when the reaction is not spent', async () => {
		dialogResult({ rollMode: -1 });
		const { panel, stop } = panelFor(striker(), vi.fn().mockResolvedValue(false));

		await panel.handleUnarmedStrike();
		stop();

		expect(fireAttackEventsMock).not.toHaveBeenCalled();
	});
});
