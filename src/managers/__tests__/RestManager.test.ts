import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

let RestManager: typeof import('../RestManager.ts').RestManager;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#managers/HitDiceManager.js', () => ({
		HitDiceManager: class {
			max = 0;
			getUpdateData() {
				return { updates: {}, recoveredData: {} };
			}
		},
	}));
	vi.doMock('#utils/chargePool/chargePoolPreview.js', () => ({ previewRecovery: () => [] }));
	({ RestManager } = await import('../RestManager.ts'));
});

const create = vi.fn();

function hero(inspiration: boolean) {
	return {
		name: 'Lyra',
		img: '',
		type: 'character',
		ownership: {},
		classes: {},
		system: {
			attributes: { hp: { value: 20, max: 20, temp: 0 }, wounds: { value: 0 } },
			resources: { mana: { current: 0, max: 0 }, inspiration },
		},
		update: vi.fn(),
		updateEmbeddedDocuments: vi.fn(),
	};
}

async function rest(actor: ReturnType<typeof hero>, restType: 'field' | 'safe') {
	vi.stubGlobal('ChatMessage', { create, getSpeaker: () => ({}) });
	const manager = new RestManager(actor as never, { restType, skipChatCard: false });
	await manager.rest();
}

const updateOf = (actor: ReturnType<typeof hero>) =>
	actor.update.mock.calls[0][0] as Record<string, unknown>;

afterEach(() => {
	create.mockReset();
	vi.unstubAllGlobals();
});

describe('RestManager', () => {
	it('ends Inspiration on a Safe Rest, and the card says so', async () => {
		const actor = hero(true);

		await rest(actor, 'safe');

		expect(updateOf(actor)['system.resources.inspiration']).toBe(false);
		expect(create).toHaveBeenCalledOnce();
		expect(create.mock.calls[0][0].system.inspirationEnded).toBe(true);
	});

	it('posts no card for a hero who is fully rested and has no Inspiration', async () => {
		const actor = hero(false);

		await rest(actor, 'safe');

		expect(updateOf(actor)).not.toHaveProperty(['system.resources.inspiration']);
		expect(create).not.toHaveBeenCalled();
	});

	it('keeps Inspiration on a Field Rest', async () => {
		const actor = hero(true);

		await rest(actor, 'field');

		expect(updateOf(actor)).not.toHaveProperty(['system.resources.inspiration']);
	});
});
