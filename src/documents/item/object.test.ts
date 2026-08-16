import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

import { NimbleBaseItem } from './base.svelte.js';
import { NimbleObjectItem } from './object.js';

const SCHOOL = 'fire';

interface ScrollOverrides {
	/** Spells the wielder already carries. A fire spell waives the Arcana check. */
	actorSpellSchools?: string[];
	/** Absent for an actor type that cannot roll a skill check at all. */
	rollSkillCheck?: ReturnType<typeof vi.fn> | null;
	quantity?: number;
	isEmbedded?: boolean;
	/** Omitted flags make an ordinary object rather than a scroll. */
	isScroll?: boolean;
}

function createScroll(overrides: ScrollOverrides = {}) {
	const {
		actorSpellSchools = [],
		rollSkillCheck = vi.fn(async () => ({
			roll: { total: 15 },
			rollData: { visibilityMode: 'publicroll' },
		})),
		quantity = 1,
		isEmbedded = true,
		isScroll = true,
	} = overrides;

	const actor = {
		type: 'character',
		items: actorSpellSchools.map((school) => ({ type: 'spell', system: { school } })),
		...(rollSkillCheck ? { rollSkillCheck } : {}),
	};

	const scroll = new NimbleObjectItem({
		name: 'Scroll of Fireball',
		type: 'object',
		system: { quantity, activation: {} },
		flags: isScroll
			? { [SYSTEM_ID]: { spellScroll: { spellUuid: 'Item.fireball', school: SCHOOL, tier: 3 } } }
			: {},
	} as never);

	Object.assign(scroll, {
		actor,
		isEmbedded,
		update: vi.fn(async () => undefined),
		delete: vi.fn(async () => undefined),
	});

	return scroll as NimbleObjectItem & {
		actor: typeof actor;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	};
}

function stubChatMessage() {
	const create = vi.fn(async () => ({}));
	const applyMode = vi.fn();

	Object.assign((globalThis as unknown as { ChatMessage: object }).ChatMessage, {
		create,
		applyMode,
		getSpeaker: vi.fn(() => ({})),
	});

	return { create, applyMode };
}

function confirmDialog() {
	return foundry.applications.api.DialogV2.confirm as unknown as ReturnType<typeof vi.fn>;
}

function setResourceSpendingAutomation(enabled: boolean): void {
	(
		globalThis as unknown as { game: { settings?: { get: ReturnType<typeof vi.fn> } } }
	).game.settings = { get: vi.fn(() => enabled) };
}

describe('NimbleObjectItem.activate', () => {
	let baseActivate: ReturnType<typeof vi.spyOn>;
	let chat: ReturnType<typeof stubChatMessage>;

	beforeEach(() => {
		vi.restoreAllMocks();

		// Base activation reports only whether a card was posted.
		baseActivate = vi
			.spyOn(NimbleBaseItem.prototype, 'activate')
			.mockResolvedValue({ id: 'chat-1' } as never);

		chat = stubChatMessage();
		confirmDialog().mockResolvedValue(true);

		setResourceSpendingAutomation(true);
	});

	describe('an object that is not a scroll', () => {
		it('activates normally, with no prompt and nothing consumed', async () => {
			const object = createScroll({ isScroll: false });

			await object.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(confirmDialog()).not.toHaveBeenCalled();
			expect(object.delete).not.toHaveBeenCalled();
		});
	});

	// The rulebook's one exemption from the check.
	describe('a wielder who knows the school', () => {
		it('asks before spending the scroll', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate();

			expect(confirmDialog()).toHaveBeenCalled();
			expect(scroll.actor.rollSkillCheck).not.toHaveBeenCalled();
		});

		it('leaves the scroll alone when the confirmation is declined', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			confirmDialog().mockResolvedValue(false);

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('casts the spell and consumes the scroll once confirmed', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		// The confirmation is the commit point, not the card. A `skipRollDialog`
		// spell, or any scroll used with Alt held, posts no dialog to back out of.
		it('consumes the scroll even when the activation posts no card', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			baseActivate.mockResolvedValue(null as never);

			await scroll.activate();

			expect(scroll.delete).toHaveBeenCalled();
		});
	});

	describe('a wielder who knows no spell of the school', () => {
		it('rolls the Arcana check instead of asking for confirmation', async () => {
			const scroll = createScroll();

			await scroll.activate();

			expect(scroll.actor.rollSkillCheck).toHaveBeenCalledWith('arcana', expect.any(Object));
			expect(confirmDialog()).not.toHaveBeenCalled();
		});

		it('casts the spell and consumes the scroll on a passing roll', async () => {
			const scroll = createScroll();

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		// "on a failure, it is wasted": the scroll is spent, the spell never happens.
		it('wastes the scroll without casting on a failing roll', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: { total: 9 }, rollData: {} })),
			});

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).toHaveBeenCalled();
		});

		it('treats a total of exactly the DC as a pass', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: { total: 10 }, rollData: {} })),
			});

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
		});

		// A check the player never agreed to must not spend anything.
		it('leaves the scroll alone when the check dialog is closed', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({ roll: null, rollData: null })),
			});

			expect(await scroll.activate()).toBeNull();

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
			expect(chat.create).not.toHaveBeenCalled();
		});

		it('follows the roll mode the GM configured, so a hidden roll stays hidden', async () => {
			const scroll = createScroll({
				rollSkillCheck: vi.fn(async () => ({
					roll: { total: 15 },
					rollData: { visibilityMode: 'blindroll' },
				})),
			});

			await scroll.activate();

			expect(chat.applyMode).toHaveBeenCalledWith(expect.any(Object), 'blind');
		});

		// Knowing a spell of the school is the rulebook's only exemption, so an actor
		// that cannot roll must not be waved through.
		it('throws for an actor that cannot roll a skill check', async () => {
			const scroll = createScroll({ rollSkillCheck: null });

			await expect(scroll.activate()).rejects.toThrow(/Arcana check/);

			expect(baseActivate).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});

	describe('consumption', () => {
		it('spends one of a stack rather than deleting it', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL], quantity: 3 });

			await scroll.activate();

			expect(scroll.update).toHaveBeenCalledWith({ 'system.quantity': 2 });
			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('leaves an unowned scroll alone, since there is no sheet to spend it from', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL], isEmbedded: false });

			await scroll.activate();

			expect(scroll.delete).not.toHaveBeenCalled();
		});

		it('leaves the scroll in place when resource spending automation is off', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });
			setResourceSpendingAutomation(false);

			await scroll.activate();

			expect(baseActivate).toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});

	describe('a macro-driven activation', () => {
		it('runs the macro path untouched, spending nothing', async () => {
			const scroll = createScroll({ actorSpellSchools: [SCHOOL] });

			await scroll.activate({ executeMacro: true });

			expect(confirmDialog()).not.toHaveBeenCalled();
			expect(scroll.delete).not.toHaveBeenCalled();
		});
	});
});
