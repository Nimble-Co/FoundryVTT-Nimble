import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { findInitiativeCard } from '../findInitiativeCard.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

const card = (id: string, rollId: string, timestamp = 0) => ({
	id,
	type: 'initiative',
	timestamp,
	system: { combatantId: 'hero' },
	flags: { [SYSTEM_ID]: { initiativeRollId: rollId } },
});

let messages: ReturnType<typeof card>[];
let created: ((message: unknown) => void) | null;
let previous: unknown;

beforeEach(() => {
	messages = [];
	created = null;
	previous = globals.game.messages;
	globals.game.messages = {
		get contents() {
			return messages;
		},
	};
	vi.mocked(Hooks.on).mockImplementation(((name: string, callback: (message: unknown) => void) => {
		if (name === 'createChatMessage') created = callback;
		return 1;
	}) as never);
});

afterEach(() => {
	globals.game.messages = previous;
	vi.useRealTimers();
});

describe('findInitiativeCard', () => {
	it('is the card of this roll, not a newer card of the same combatant', async () => {
		messages.push(card('this-roll', 'roll-1'), card('other-roll', 'roll-2'));

		expect((await findInitiativeCard({ id: 'hero' }, 'roll-1'))?.id).toBe('this-roll');
	});

	it('finds the card of this roll whatever the clock of the client that made it says', async () => {
		messages.push(card('old-clock', 'roll-1', 1));

		expect((await findInitiativeCard({ id: 'hero' }, 'roll-1'))?.id).toBe('old-clock');
	});

	it('waits for the card of this roll and passes over the card of another roll', async () => {
		const found = findInitiativeCard({ id: 'hero' }, 'roll-1');

		created?.(card('other-roll', 'roll-2'));
		created?.(card('this-roll', 'roll-1'));

		expect((await found)?.id).toBe('this-roll');
	});

	it('is null when the card of this roll does not come', async () => {
		vi.useFakeTimers();
		const found = findInitiativeCard({ id: 'hero' }, 'roll-1');

		await vi.advanceTimersByTimeAsync(5000);

		expect(await found).toBeNull();
	});
});
