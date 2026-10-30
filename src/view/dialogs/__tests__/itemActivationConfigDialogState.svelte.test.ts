import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const conditionalBonuses = vi.fn(() => []);

// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
let createState: typeof import('../itemActivationConfigDialogState.svelte.ts').createItemActivationConfigDialogState;

const math = Math as unknown as { clamp?: (value: number, min: number, max: number) => number };
const ownClamp = math.clamp;

beforeAll(async () => {
	math.clamp ??= (value, min, max) => Math.min(max, Math.max(min, value));
	vi.resetModules();
	vi.doMock('#utils/actor/conditionalBonuses.js', () => ({
		getActiveConditionalBonuses: conditionalBonuses,
	}));
	({ createItemActivationConfigDialogState: createState } = await import(
		'../itemActivationConfigDialogState.svelte.ts'
	));
});

const user = (globalThis as unknown as { game: { user: { targets?: unknown } } }).game.user;
const before = user.targets;

afterEach(() => {
	user.targets = before;
	conditionalBonuses.mockClear();
});

afterAll(() => {
	math.clamp = ownClamp;
});

function openWith(targetActors: object[]) {
	user.targets = new Set(targetActors.map((actor) => ({ actor })));
	createState({
		actor: () => ({ rules: [], system: {}, items: [], getFlag: () => undefined }) as never,
		item: () => ({ type: 'weapon', system: { activation: { effects: [] } } }) as never,
		hideRollsDefault: false,
	});
	return (conditionalBonuses.mock.calls[0] as unknown[])[2];
}

describe('the activation dialog conditional bonuses', () => {
	it('test the target when there is one', () => {
		const goblin = { uuid: 'Actor.goblin' };

		expect(openWith([goblin])).toBe(goblin);
	});

	it('have no target to test with two targets', () => {
		expect(openWith([{ uuid: 'Actor.goblin' }, { uuid: 'Actor.kobold' }])).toBeUndefined();
	});
});
