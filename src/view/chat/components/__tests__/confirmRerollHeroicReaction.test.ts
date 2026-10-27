import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.js';
import { confirmRerollHeroicReaction } from '../confirmRerollHeroicReaction.js';

const testGlobals = globalThis as unknown as {
	fromUuidSync: unknown;
	game: { combat?: unknown; settings?: unknown; user?: { isGM: boolean } };
	foundry: { applications: { api: { DialogV2: { confirm: ReturnType<typeof vi.fn> } } } };
};

const entry = {
	id: 'entry-1',
	kind: 'reroll',
	actorUuid: 'Actor.hero',
	itemUuid: 'Item.feature',
	ruleId: 'rule-1',
} as IncomingReactionEntry;

function setup(options: {
	heroicReaction?: string;
	defendAvailable?: boolean;
	inCombat?: boolean;
}) {
	const actor = { uuid: 'Actor.hero', isOwner: true, rules: [] };
	const rule = {
		type: 'reroll',
		id: 'rule-1',
		rerollCost: { heroicReaction: options.heroicReaction ?? 'defend' },
	};
	testGlobals.fromUuidSync = vi.fn((uuid: string) => {
		if (uuid === 'Actor.hero') return actor;
		if (uuid === 'Item.feature') return { rules: new Map([['rule-1', rule]]) };
		return null;
	});
	const combatant = {
		id: 'c1',
		type: 'character',
		actor,
		system: {
			actions: {
				base: { current: 3 },
				heroic: { defendAvailable: options.defendAvailable ?? true },
			},
		},
	};
	testGlobals.game.combat =
		options.inCombat === false
			? null
			: {
					id: 'combat-1',
					started: true,
					round: 1,
					combatant: null,
					combatants: { find: (predicate: (c: unknown) => boolean) => [combatant].find(predicate) },
				};
}

describe('confirmRerollHeroicReaction', () => {
	beforeEach(() => {
		testGlobals.game.user = { isGM: true };
		testGlobals.foundry.applications.api.DialogV2.confirm = vi.fn(async () => true);
	});

	afterEach(() => {
		testGlobals.game.combat = null;
	});

	it('asks nothing when the reroll costs no heroic reaction', async () => {
		setup({ heroicReaction: '' });
		await expect(confirmRerollHeroicReaction(entry)).resolves.toBe(false);
		expect(testGlobals.foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
	});

	it('asks nothing while the heroic reaction is free to use, or out of combat', async () => {
		setup({ defendAvailable: true });
		await expect(confirmRerollHeroicReaction(entry)).resolves.toBe(false);
		setup({ inCombat: false });
		await expect(confirmRerollHeroicReaction(entry)).resolves.toBe(false);
		expect(testGlobals.foundry.applications.api.DialogV2.confirm).not.toHaveBeenCalled();
	});

	it('asks before using a heroic reaction already spent, and passes on the answer', async () => {
		setup({ defendAvailable: false });
		await expect(confirmRerollHeroicReaction(entry)).resolves.toBe(true);

		testGlobals.foundry.applications.api.DialogV2.confirm = vi.fn(async () => false);
		await expect(confirmRerollHeroicReaction(entry)).resolves.toBeNull();
	});

	it('asks also while resource spending automation is off', async () => {
		setup({ defendAvailable: false });
		testGlobals.game.settings = {
			get: (_scope: string, key: string) => key !== 'automation.resourceSpending',
		};
		try {
			await expect(confirmRerollHeroicReaction(entry)).resolves.toBe(true);
		} finally {
			delete testGlobals.game.settings;
		}
	});
});
