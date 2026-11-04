import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

const invokeChaos = vi.fn(async () => {});
let automation = true;

const lash = { type: 'tableRoll', table: 'chaos', when: 'onUse', invokesChaos: true };
const force = { type: 'tableRoll', table: 'chaos', when: 'lessManaOrCrit', invokesChaos: true };

let invokeChaosOnUse: typeof import('../chaosOnUse.js').invokeChaosOnUse;

beforeEach(async () => {
	invokeChaos.mockClear();
	automation = true;
	vi.resetModules();
	vi.doMock('#utils/chaos/invokeChaos.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		invokeChaos,
	}));
	vi.doMock('../../settings/automationSettings.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		isRuleAutomationEnabled: () => automation,
	}));
	({ invokeChaosOnUse } = await import('../chaosOnUse.js'));
	vi.doUnmock('#utils/chaos/invokeChaos.js');
	vi.doUnmock('../../settings/automationSettings.js');
});

/** The used item with these rules, and its card after the use. */
async function useItem(rules: object[]) {
	const actor = { uuid: 'Actor.hero' };
	const item = { actor, rules: new Map(rules.map((rule, index) => [String(index), rule])) };
	const flags: Record<string, unknown> = {};
	const card = {
		id: 'message-1',
		setFlag: vi.fn(async (scope: string, key: string, value: unknown) => {
			if (scope === SYSTEM_ID) flags[key] = value;
		}),
	};
	await invokeChaosOnUse(item, card);
	return { flags, actor };
}

describe('an item that invokes Chaos when it is used', () => {
	it('rolls on its table with Feature Effects on', async () => {
		const { flags, actor } = await useItem([lash]);

		expect(flags).toEqual({ chaosInvoked: true });
		expect(invokeChaos).toHaveBeenCalledWith(actor, 'message-1', 'chaos');
	});

	it('leaves the roll to the Chaos button with Feature Effects off', async () => {
		automation = false;

		const { flags } = await useItem([lash]);

		expect(flags).toEqual({ chaosTicked: true });
		expect(invokeChaos).not.toHaveBeenCalled();
	});

	it('does nothing for an item with no such rule', async () => {
		const { flags } = await useItem([force]);

		expect(flags).toEqual({});
		expect(invokeChaos).not.toHaveBeenCalled();
	});

	it('does nothing when a rule took the card away', async () => {
		await invokeChaosOnUse({ actor: {}, rules: new Map([['0', lash]]) }, null);

		expect(invokeChaos).not.toHaveBeenCalled();
	});
});
