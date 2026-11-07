import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroicReactionUsageBlockedReason } from '#utils/incomingReactions/getHeroicReactionUsageState.js';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.js';

const mocks = vi.hoisted(() => ({
	showReactionConfirmation: vi.fn(),
	getHeroicReactionUsageState: vi.fn(),
}));

const testGlobals = globalThis as unknown as {
	fromUuidSync: unknown;
	game: { combat?: unknown };
};

let spendInterpose: typeof import('../spendInterpose.js').spendInterpose;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/incomingReactions/showReactionConfirmation.js', () => ({
		default: mocks.showReactionConfirmation,
	}));
	vi.doMock('#utils/incomingReactions/getHeroicReactionUsageState.js', async (importOriginal) => ({
		...(await importOriginal<
			typeof import('#utils/incomingReactions/getHeroicReactionUsageState.js')
		>()),
		getHeroicReactionUsageState: mocks.getHeroicReactionUsageState,
	}));
	({ spendInterpose } = await import('../spendInterpose.js'));
});

interface CombatFixture {
	started: boolean;
	combatants: {
		find: (predicate: (combatant: { id: string; tokenId: string }) => boolean) => unknown;
	};
	useHeroicReactions?: ReturnType<typeof vi.fn>;
}

function createEntry(tokenUuid: string | null = 'Scene.s1.Token.t1'): IncomingReactionEntry {
	return { id: 'entry-1', kind: 'interpose', tokenUuid } as unknown as IncomingReactionEntry;
}

function createCombatant(tokenId = 't1') {
	return { id: 'c1', tokenId };
}

function createCombat(
	options: { started?: boolean; combatantTokenId?: string; withSpend?: boolean } = {},
): CombatFixture {
	const combatant = createCombatant(options.combatantTokenId);
	const combat: CombatFixture = {
		started: options.started ?? true,
		combatants: { find: (predicate) => [combatant].find(predicate) },
	};
	if (options.withSpend !== false) combat.useHeroicReactions = vi.fn(async () => true);
	return combat;
}

function useCombat(combat: CombatFixture | null): CombatFixture | null {
	testGlobals.game.combat = combat;
	return combat;
}

function useToken(token: { id: string } | null = { id: 't1' }) {
	testGlobals.fromUuidSync = vi.fn(() => token);
}

function blockWith(reason: HeroicReactionUsageBlockedReason | null) {
	mocks.getHeroicReactionUsageState.mockReturnValue({ blockedReason: reason });
}

describe('spendInterpose', () => {
	beforeEach(() => {
		useToken();
		blockWith(null);
		mocks.showReactionConfirmation.mockResolvedValue(true);
	});

	afterEach(() => {
		testGlobals.game.combat = null;
		mocks.getHeroicReactionUsageState.mockReset();
		mocks.showReactionConfirmation.mockReset();
	});

	describe('when there is nothing to spend', () => {
		it('returns true with no combat', async () => {
			useCombat(null);

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
		});

		it('returns true and spends nothing when the combat has not started', async () => {
			const combat = useCombat(createCombat({ started: false }));

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
			expect(combat?.useHeroicReactions).not.toHaveBeenCalled();
		});

		it('returns true when the combat has no useHeroicReactions', async () => {
			useCombat(createCombat({ withSpend: false }));

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
			expect(testGlobals.fromUuidSync).not.toHaveBeenCalled();
		});

		it('returns true and spends nothing when the entry has no token', async () => {
			const combat = useCombat(createCombat());

			await expect(spendInterpose(createEntry(null))).resolves.toBe(true);
			expect(combat?.useHeroicReactions).not.toHaveBeenCalled();
		});

		it('returns true and spends nothing when the token cannot be found', async () => {
			const combat = useCombat(createCombat());
			useToken(null);

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
			expect(combat?.useHeroicReactions).not.toHaveBeenCalled();
		});

		it('returns true and spends nothing when no combatant has the token', async () => {
			const combat = useCombat(createCombat({ combatantTokenId: 'other-token' }));

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
			expect(combat?.useHeroicReactions).not.toHaveBeenCalled();
		});
	});

	describe('with force', () => {
		it('spends the Interpose with force and returns the result of the spend', async () => {
			const combat = useCombat(createCombat());
			combat?.useHeroicReactions?.mockResolvedValue(false);

			await expect(spendInterpose(createEntry(), { force: true })).resolves.toBe(false);
			expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(1);
			expect(combat?.useHeroicReactions).toHaveBeenCalledWith('c1', ['interpose'], {
				force: true,
			});
		});

		it('does not show the confirmation', async () => {
			useCombat(createCombat());

			await spendInterpose(createEntry(), { force: true });

			expect(mocks.showReactionConfirmation).not.toHaveBeenCalled();
		});
	});

	describe('without force', () => {
		it('returns true when the spend succeeds', async () => {
			const combat = useCombat(createCombat());

			await expect(spendInterpose(createEntry())).resolves.toBe(true);
			expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(1);
			expect(combat?.useHeroicReactions).toHaveBeenCalledWith('c1', ['interpose']);
			expect(mocks.showReactionConfirmation).not.toHaveBeenCalled();
		});

		it('reads the usage state of the Interpose for the combatant when the spend fails', async () => {
			const combat = useCombat(createCombat());
			combat?.useHeroicReactions?.mockResolvedValue(false);
			blockWith('notOwner');

			await spendInterpose(createEntry());

			expect(mocks.getHeroicReactionUsageState).toHaveBeenCalledWith({
				combat,
				combatant: createCombatant(),
				reactionKeys: ['interpose'],
			});
		});

		it.each<HeroicReactionUsageBlockedReason>(['notOwner', 'dead', 'outsideCombat', 'notUsable'])(
			'returns false with no confirmation on the hard block %s',
			async (reason) => {
				const combat = useCombat(createCombat());
				combat?.useHeroicReactions?.mockResolvedValue(false);
				blockWith(reason);

				await expect(spendInterpose(createEntry())).resolves.toBe(false);
				expect(mocks.showReactionConfirmation).not.toHaveBeenCalled();
				expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(1);
			},
		);

		it.each([
			['spent', { hasSpentReactions: true, noActions: false, isActiveTurn: false }],
			['noActions', { hasSpentReactions: false, noActions: true, isActiveTurn: false }],
			['activeTurn', { hasSpentReactions: false, noActions: false, isActiveTurn: true }],
		] as const)('shows the confirmation for the soft block %s', async (reason, flags) => {
			const combat = useCombat(createCombat());
			combat?.useHeroicReactions?.mockResolvedValue(false);
			blockWith(reason);

			await spendInterpose(createEntry());

			expect(mocks.showReactionConfirmation).toHaveBeenCalledWith({
				reactionName: 'Interpose',
				spentReactionNames: 'Interpose',
				...flags,
			});
		});

		it.each<HeroicReactionUsageBlockedReason>(['spent', 'noActions', 'activeTurn'])(
			'returns false and spends no more when the user cancels the soft block %s',
			async (reason) => {
				const combat = useCombat(createCombat());
				combat?.useHeroicReactions?.mockResolvedValue(false);
				blockWith(reason);
				mocks.showReactionConfirmation.mockResolvedValue(false);

				await expect(spendInterpose(createEntry())).resolves.toBe(false);
				expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(1);
			},
		);

		it.each<HeroicReactionUsageBlockedReason>(['spent', 'noActions', 'activeTurn'])(
			'spends with force when the user confirms the soft block %s',
			async (reason) => {
				const combat = useCombat(createCombat());
				combat?.useHeroicReactions?.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
				blockWith(reason);

				await expect(spendInterpose(createEntry())).resolves.toBe(true);
				expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(2);
				expect(combat?.useHeroicReactions).toHaveBeenLastCalledWith('c1', ['interpose'], {
					force: true,
				});
			},
		);

		it('returns false when the forced spend after the confirmation fails', async () => {
			const combat = useCombat(createCombat());
			combat?.useHeroicReactions?.mockResolvedValue(false);
			blockWith('spent');

			await expect(spendInterpose(createEntry())).resolves.toBe(false);
			expect(combat?.useHeroicReactions).toHaveBeenCalledTimes(2);
		});
	});
});
