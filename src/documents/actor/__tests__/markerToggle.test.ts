import { SYSTEM_ID } from '#system';
import { NimbleBaseActor } from '../base.svelte.js';

function marker(id: string, itemUuid: string) {
	return {
		id,
		statuses: new Set(['marked']),
		getFlag: (scope: string, key: string) =>
			scope === SYSTEM_ID && key === 'markTargetItemUuid' ? itemUuid : undefined,
	};
}

type ToggleHost = {
	toggleStatusEffect(statusId: string, options?: { active?: boolean }): Promise<unknown>;
	deleteEmbeddedDocuments: ReturnType<typeof vi.fn>;
};

function createMarkedActor(effects: unknown[]) {
	return Object.assign(Object.create(NimbleBaseActor.prototype), {
		effects,
		deleteEmbeddedDocuments: vi.fn(async () => []),
	}) as ToggleHost;
}

const coreActor = Object.getPrototypeOf(NimbleBaseActor.prototype) as {
	toggleStatusEffect?: unknown;
};
const coreToggle = () => coreActor.toggleStatusEffect as ReturnType<typeof vi.fn>;

beforeEach(() => {
	coreActor.toggleStatusEffect = vi.fn(async () => undefined);
});

afterEach(() => {
	coreActor.toggleStatusEffect = undefined;
});

describe('NimbleBaseActor#toggleStatusEffect with marker effects', () => {
	it('turning the status off takes off every marker that shows it', async () => {
		const actor = createMarkedActor([marker('a', 'Item.exploit'), marker('b', 'Item.mark')]);

		expect(await actor.toggleStatusEffect('marked')).toBe(false);
		expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a', 'b']);
		expect(coreToggle()).toHaveBeenCalledWith('marked', { active: false });
	});

	it('turning the status on keeps the markers and adds nothing', async () => {
		const actor = createMarkedActor([marker('a', 'Item.exploit')]);

		expect(await actor.toggleStatusEffect('marked', { active: true })).toBe(true);
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(coreToggle()).not.toHaveBeenCalled();
	});

	it('leaves a status with no markers to core', async () => {
		const actor = createMarkedActor([]);

		await actor.toggleStatusEffect('marked');

		expect(coreToggle()).toHaveBeenCalledWith('marked', {});
		expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});
