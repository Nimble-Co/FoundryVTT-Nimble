import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SYSTEM_ID } from '#system';

const endMark = vi.fn();
let createTargetMarksState: typeof import('../Targets.svelte.ts').createTargetMarksState;

beforeAll(async () => {
	// The test setup already loaded markLifecycle through init, so mock it on a fresh import.
	vi.resetModules();
	vi.doMock('#utils/actor/markLifecycle.ts', async (importOriginal) => ({
		...(await importOriginal<object>()),
		endMark,
		marksOfItem: () => [],
	}));
	({ createTargetMarksState } = await import('../Targets.svelte.ts'));
});

afterAll(() => {
	vi.doUnmock('#utils/actor/markLifecycle.ts');
	vi.resetModules();
});

const item = { uuid: 'Actor.cheat.Item.exploit', name: 'Exploit Weakness', rules: [], actor: null };
const card = (isOwner: boolean) => ({
	flags: { [SYSTEM_ID]: { itemId: 'exploit' } },
	speakerActor: { isOwner, items: { get: () => item } },
});
const mark = { actorUuid: 'Actor.goblin', tokenUuid: null, name: 'Goblin' };

describe('createTargetMarksState', () => {
	it('runs one end at a time', async () => {
		let finish: () => void = () => {};
		endMark.mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)));
		const state = createTargetMarksState(card(true));

		const first = state.endMarkOn(mark);
		await state.endMarkOn(mark);
		expect(state.ending).toBe(true);
		finish();
		await first;

		expect(endMark).toHaveBeenCalledTimes(1);
		expect(state.ending).toBe(false);
	});

	it('ends nothing for a user who does not own the marking creature', async () => {
		endMark.mockClear();
		await createTargetMarksState(card(false)).endMarkOn(mark);

		expect(endMark).not.toHaveBeenCalled();
	});
});
