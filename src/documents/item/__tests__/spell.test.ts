import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpellCostActorLike, SpellLike as SpellCostSpellLike } from '#types/spellCost.d.ts';
import { ItemActivationManager } from '../../../managers/ItemActivationManager.js';
import { resolveSpellCost } from '../../../utils/spell/spellCost.js';
import { NimbleBaseItem } from '../base.svelte.js';
import { NimbleSpellItem } from '../spell.js';

interface SpellLike {
	id: string;
	uuid: string;
	name: string;
	img: string;
	permission: number;
	system: { tier: number };
	actor: {
		id: string;
		name: string;
		type: string;
		token: null;
		system: { resources: { mana: { current: number; max: number } } };
		update: ReturnType<typeof vi.fn>;
	};
	prepareChatCardData: ReturnType<typeof vi.fn>;
	_createActivationCard: ReturnType<typeof vi.fn>;
}

/**
 * The spell whose cost the stubbed manager should resolve. Activation reads
 * the cost off the manager, so the stub has to produce one the way the real
 * `getData` would.
 */
let activatingSpell: SpellLike | null = null;

function createSpellLike(params: { tier: number; currentMana: number }): SpellLike {
	return {
		id: 'spell-1',
		uuid: 'Item.spell-1',
		name: 'Test Spell',
		img: 'icons/svg/explosion.svg',
		permission: 3,
		system: { tier: params.tier },
		actor: {
			id: 'actor-1',
			name: 'Test Caster',
			type: 'character',
			token: null,
			system: { resources: { mana: { current: params.currentMana, max: 10 } } },
			update: vi.fn(async () => undefined),
		},
		prepareChatCardData: vi.fn(async () => ({})),
		_createActivationCard: vi.fn(async () => null),
	};
}

async function activateSpell(spellLike: SpellLike): Promise<void> {
	// The stubbed manager resolves the cost for whichever spell is being
	// activated, so name it here rather than as a side effect of building one.
	activatingSpell = spellLike;
	// The spell's own steps (its cost, its hook context) come from its prototype.
	Object.setPrototypeOf(spellLike, NimbleSpellItem.prototype);
	await NimbleSpellItem.prototype.activate.call(spellLike as unknown as NimbleSpellItem, {});
}

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as {
			game: { settings?: { get: ReturnType<typeof vi.fn> } };
		}
	).game.settings = { get: vi.fn(() => enabled) };
}

describe('NimbleSpellItem.activate mana spending', () => {
	beforeEach(() => {
		// The full activation manager drives dialogs and roll construction; stub
		// its data preparation so activate() immediately receives a roll-less
		// activation and proceeds straight to its resource-spending step.
		vi.spyOn(ItemActivationManager.prototype, 'getData').mockImplementation(async function (
			this: ItemActivationManager,
		) {
			// The real getData resolves the cast's cost before returning; keep that
			// part so activate() sees the cost it would see in play.
			this.spellCost = activatingSpell
				? resolveSpellCost(
						activatingSpell.actor as unknown as SpellCostActorLike,
						activatingSpell as unknown as SpellCostSpellLike,
					)
				: null;
			return {
				activation: { effects: [] },
				rolls: [],
				rollHidden: false,
				incomingReactions: [],
			} as never;
		});
		vi.spyOn(ItemActivationManager.prototype, 'applyDeferredPoolNodes').mockResolvedValue(
			undefined as never,
		);
		(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(
			globalThis as unknown as {
				ChatMessage: { getSpeaker: ReturnType<typeof vi.fn> };
			}
		).ChatMessage.getSpeaker = vi.fn(() => ({}));
		(
			globalThis as unknown as {
				CONST: { CHAT_MESSAGE_STYLES: { OTHER: number } };
			}
		).CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
		(
			globalThis as unknown as {
				CONFIG: { sounds: { dice: string } };
			}
		).CONFIG.sounds = { dice: 'dice' };
	});

	afterEach(() => {
		activatingSpell = null;
		(
			globalThis as unknown as {
				game: { settings?: unknown };
			}
		).game.settings = undefined;
	});

	it('does not deduct mana for a tiered spell when resource-spending automation is off', async () => {
		setResourceSpendingAutomation(false);
		const spellLike = createSpellLike({ tier: 1, currentMana: 5 });

		await activateSpell(spellLike);

		expect(spellLike.actor.update).not.toHaveBeenCalled();
		// The activation itself still completes and posts its card.
		expect(spellLike._createActivationCard).toHaveBeenCalledTimes(1);
	});

	it('deducts the tier cost from current mana when resource-spending automation is on', async () => {
		setResourceSpendingAutomation(true);
		const spellLike = createSpellLike({ tier: 2, currentMana: 5 });

		await activateSpell(spellLike);

		expect(spellLike.actor.update).toHaveBeenCalledTimes(1);
		expect(spellLike.actor.update).toHaveBeenCalledWith({
			'system.resources.mana.current': 3,
		});
	});

	it('refuses the cast and writes nothing when the cost exceeds current mana', async () => {
		setResourceSpendingAutomation(true);
		vi.mocked(ui.notifications!.error).mockClear();
		const spellLike = createSpellLike({ tier: 3, currentMana: 1 });

		await activateSpell(spellLike);

		expect(spellLike.actor.update).not.toHaveBeenCalled();
		expect(spellLike._createActivationCard).not.toHaveBeenCalled();
		expect(ui.notifications?.error).toHaveBeenCalledTimes(1);
	});

	it('never deducts mana for a cantrip even with resource-spending automation on', async () => {
		setResourceSpendingAutomation(true);
		const spellLike = createSpellLike({ tier: 0, currentMana: 5 });

		await activateSpell(spellLike);

		expect(spellLike.actor.update).not.toHaveBeenCalled();
	});

	it('gives the hooks the upcast and the free use, as every item use does', async () => {
		setResourceSpendingAutomation(false);
		const spellLike = createSpellLike({ tier: 0, currentMana: 5 });

		await activateSpell(spellLike);

		const preUse = (Hooks.call as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2];
		expect(preUse).toMatchObject({ freeUse: false });
		expect(preUse).toHaveProperty('upcast');
		const useContext = spellLike._createActivationCard.mock.calls[0][3];
		expect(useContext).toMatchObject({ freeUse: false });
		expect(useContext).toHaveProperty('upcast');
	});

	it('targets no one for a healing spell with no target picked', async () => {
		setResourceSpendingAutomation(false);
		vi.mocked(ItemActivationManager.prototype.getData).mockResolvedValue({
			activation: { effects: [{ type: 'healing' }] },
			rolls: [],
			rollHidden: false,
			incomingReactions: [],
		} as never);
		const spellLike = createSpellLike({ tier: 0, currentMana: 5 });
		const getActiveTokens = vi.fn(() => [{ document: { uuid: 'Token.caster' } }]);
		Object.assign(spellLike.actor, { getActiveTokens });

		await activateSpell(spellLike);

		const chatData = spellLike._createActivationCard.mock.calls[0][0] as {
			system: { targets: string[] };
		};
		expect(chatData.system.targets).toEqual([]);
		expect(getActiveTokens).not.toHaveBeenCalled();
	});

	it('still targets the user for a healing item that is not a spell', async () => {
		setResourceSpendingAutomation(false);
		vi.mocked(ItemActivationManager.prototype.getData).mockResolvedValue({
			activation: { effects: [{ type: 'healing' }] },
			rolls: [],
			rollHidden: false,
			incomingReactions: [],
		} as never);
		const potionLike = createSpellLike({ tier: 0, currentMana: 5 });
		Object.assign(potionLike.actor, {
			getActiveTokens: vi.fn(() => [{ document: { uuid: 'Token.caster' } }]),
		});
		Object.setPrototypeOf(potionLike, NimbleBaseItem.prototype);

		await NimbleBaseItem.prototype.activate.call(potionLike as unknown as NimbleBaseItem, {});

		const chatData = potionLike._createActivationCard.mock.calls[0][0] as {
			system: { targets: string[] };
		};
		expect(chatData.system.targets).toEqual(['Token.caster']);
	});
});
