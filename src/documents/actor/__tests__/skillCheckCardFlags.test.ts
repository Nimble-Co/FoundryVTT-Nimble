import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

const createCheckCard = vi.fn(async (chatData: unknown) => chatData);
vi.resetModules();
const rollTarget = await vi.importActual<
	typeof import('../../../utils/reroll/checkCardRollTarget.js')
>('../../../utils/reroll/checkCardRollTarget.js');
vi.doMock('../../../utils/reroll/checkCardRollTarget.js', () => ({
	...rollTarget,
	checkCardRerollData: vi.fn(async (_actor: unknown, roll: unknown) => ({ roll, system: {} })),
	createCheckCard,
}));
const { NimbleCharacter } = await import('../character.js');

function hero() {
	return {
		rollSkillCheck: vi.fn(async () => ({
			roll: { total: 12 },
			rollData: { rollMode: 0, visibilityMode: 'publicroll' },
		})),
		prepareSkillCheckChatCardData: vi.fn(async () => ({
			type: 'skillCheck',
			system: { skillKey: 'finesse' },
		})),
	};
}

describe('rollSkillCheckToChat', () => {
	const utils = foundry.utils as unknown as { mergeObject: unknown };
	const shallowMerge = utils.mergeObject;

	beforeEach(() => {
		vi.stubGlobal('ChatMessage', { applyMode: vi.fn() });
		// Foundry merges in place; the shared mock returns a copy.
		utils.mergeObject = (target: Record<string, unknown>, source: Record<string, unknown>) =>
			Object.assign(target, source);
	});

	afterEach(() => {
		utils.mergeObject = shallowMerge;
		vi.unstubAllGlobals();
	});

	it('puts the card flags of the roll on the skill check card', async () => {
		const actor = hero();
		const link = { effectId: 'thorn' };

		const card = (await NimbleCharacter.prototype.rollSkillCheckToChat.call(
			actor as never,
			'finesse',
			{ dc: 12, cardFlags: { escapeRoll: link } },
		)) as unknown as { flags?: Record<string, Record<string, unknown>> };

		expect(card.flags?.[SYSTEM_ID]).toEqual({ escapeRoll: link });
	});

	it('makes a card with no flags of its own when the roll has none', async () => {
		const card = (await NimbleCharacter.prototype.rollSkillCheckToChat.call(
			hero() as never,
			'finesse',
			{},
		)) as unknown as { flags?: Record<string, unknown> };

		expect(card.flags?.[SYSTEM_ID]).toBeUndefined();
	});
});
