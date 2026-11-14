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

	it('gives the Mana back when the card fails to post', async () => {
		setResourceSpendingAutomation(true);
		const spellLike = createSpellLike({ tier: 2, currentMana: 5 });
		const mana = spellLike.actor.system.resources.mana;
		spellLike.actor.update.mockImplementation(async (changes: Record<string, number>) => {
			mana.current = changes['system.resources.mana.current'];
		});
		const failure = new Error('card failed');
		spellLike._createActivationCard.mockRejectedValue(failure);

		await expect(activateSpell(spellLike)).rejects.toBe(failure);

		expect(spellLike.actor.update.mock.calls).toEqual([
			[{ 'system.resources.mana.current': 3 }],
			[{ 'system.resources.mana.current': 5 }],
		]);
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

	describe('the targets of the card', () => {
		const globals = globalThis as unknown as { game: { user: { targets: unknown } } };
		let userTargets: unknown;

		beforeEach(() => {
			userTargets = globals.game.user.targets;
			globals.game.user.targets = [{ document: { uuid: 'Token.goblin' } }];
			setResourceSpendingAutomation(false);
		});

		afterEach(() => {
			globals.game.user.targets = userTargets;
		});

		function activateItem(options: ItemActivationManager.ActivationOptions) {
			const itemLike = createSpellLike({ tier: 0, currentMana: 5 });
			Object.setPrototypeOf(itemLike, NimbleBaseItem.prototype);
			return NimbleBaseItem.prototype.activate
				.call(itemLike as unknown as NimbleBaseItem, options)
				.then(() => itemLike._createActivationCard.mock.calls[0]);
		}

		it('are what the user targets on a normal use', async () => {
			const [chatData, , , context] = await activateItem({});

			expect(chatData.system.targets).toEqual(['Token.goblin']);
			expect(context.targets).toEqual([{ document: { uuid: 'Token.goblin' } }]);
		});

		it('are none on a free use, which a trigger starts and not the user', async () => {
			const [chatData, , , context] = await activateItem({
				fastForward: true,
				free: { of: [], reason: { key: 'For free' } },
			});

			expect(chatData.system.targets).toEqual([]);
			expect(context.targets).toEqual([]);
			const preUse = (Hooks.call as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2];
			expect(preUse.targets).toEqual([]);
		});
	});
});

describe('NimbleSpellItem use context', () => {
	const contextOf = (tier: number, spellCost: unknown) =>
		(
			NimbleSpellItem.prototype as unknown as {
				_useContext(this: unknown, manager: unknown): Record<string, unknown>;
			}
		)._useContext.call({ system: { tier } }, { spellCost, upcastResult: null });

	it('gives the mana the cast costs, after Free of mana and less mana', () => {
		expect(contextOf(2, { type: 'mana', amount: 3 }).manaSpent).toBe(3);
		expect(contextOf(2, { type: 'mana', amount: 1 }).manaSpent).toBe(1);
		expect(contextOf(2, { type: 'none' }).manaSpent).toBe(0);
	});

	it('gives 0 mana for a cast paid from a pool, a cantrip, and a cast with no cost', () => {
		expect(contextOf(2, { type: 'pool', amount: 2, poolIdentifier: 'x' }).manaSpent).toBe(0);
		expect(contextOf(0, { type: 'mana', amount: 0 }).manaSpent).toBe(0);
		expect(contextOf(2, null).manaSpent).toBe(0);
	});
});
