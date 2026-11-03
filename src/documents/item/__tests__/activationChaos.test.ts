import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

const invokeChaos = vi.fn(async () => {});
let automation = true;
const postedMessage = { id: 'message-1', system: { activation: {} } };

const lash = { type: 'tableRoll', table: 'chaos', when: 'onUse', invokesChaos: true };
const force = { type: 'tableRoll', table: 'chaos', when: 'lessManaOrCrit', invokesChaos: true };

/** The real `_createActivationCard` of an item with these rules. */
async function useItem(rules: object[]) {
	vi.resetModules();
	vi.doMock('#utils/chaos/invokeChaos.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		invokeChaos,
	}));
	vi.doMock('../../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	const { NimbleBaseItem } = await import('../base.svelte.js');
	vi.doUnmock('#utils/chaos/invokeChaos.js');
	vi.doUnmock('../../../settings/automationSettings.js');

	const actor = { uuid: 'Actor.hero', system: {}, statuses: new Set(), effects: [] };
	const item = Object.assign(Object.create(NimbleBaseItem.prototype), {
		uuid: 'Item.feature',
		type: 'feature',
		tags: new Set(),
		actor,
		rules: new Map(rules.map((rule, index) => [String(index), rule])),
	});
	const chatData = { type: 'feature', system: {}, flags: { [SYSTEM_ID]: { itemId: 'feature' } } };
	await (
		item as {
			_createActivationCard(...args: unknown[]): Promise<unknown>;
		}
	)._createActivationCard(chatData, [], { effects: [{ type: 'move' }] }, {});
	return { chatData, actor };
}

beforeEach(() => {
	invokeChaos.mockClear();
	automation = true;
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	(ChatMessage as unknown as { create: unknown }).create = vi.fn(async () => postedMessage);
	(CONFIG as { statusEffects?: unknown }).statusEffects = [];
	(globalThis as { ui?: Record<string, unknown> }).ui = { notifications: { warn: vi.fn() } };
});

describe('an item that invokes Chaos when it is used', () => {
	it('rolls on its table with Feature Effects on', async () => {
		const { chatData, actor } = await useItem([lash]);

		expect(chatData.flags[SYSTEM_ID]).toMatchObject({ itemId: 'feature', chaosInvoked: true });
		expect(invokeChaos).toHaveBeenCalledWith(actor, 'message-1', 'chaos');
	});

	it('leaves the roll to the Chaos button with Feature Effects off', async () => {
		automation = false;

		const { chatData } = await useItem([lash]);

		expect(chatData.flags[SYSTEM_ID]).toMatchObject({ itemId: 'feature', chaosTicked: true });
		expect(invokeChaos).not.toHaveBeenCalled();
	});

	it('does nothing for an item with no such rule', async () => {
		const { chatData } = await useItem([force]);

		expect(chatData.flags[SYSTEM_ID]).toEqual({ itemId: 'feature' });
		expect(invokeChaos).not.toHaveBeenCalled();
	});
});
