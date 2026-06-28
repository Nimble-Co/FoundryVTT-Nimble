import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hampered (and other triggered conditions) are applied/removed automatically
// in reaction to Dazed/Grappled/etc. Foundry fires create/deleteActiveEffect
// hooks on EVERY connected client, so these follow-up writes must be gated to
// the single active GM — otherwise players hit "lacks permission" errors and
// the effect stacks once per connected user with permission.

vi.mock('./conditionImmunityGuard.js', () => ({
	isConditionImmune: vi.fn(() => false),
}));

import { handleAutomaticConditionApplication } from './automaticConditions.js';

interface MockActor {
	documentName: 'Actor';
	statuses: Set<string>;
	toggleStatusEffect: ReturnType<typeof vi.fn>;
}

function createActor(): MockActor {
	return {
		documentName: 'Actor',
		statuses: new Set<string>(),
		toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
	};
}

function createDocument(actor: MockActor, statuses: string[] = ['dazed']) {
	return {
		id: 'effect-1',
		parent: actor,
		statuses: new Set(statuses),
	};
}

/** Stub the global `game` for a given current user / active GM pairing. */
function stubGame(opts: {
	currentUserId: string;
	currentUserIsGM: boolean;
	activeGmId: string | null;
}): void {
	vi.stubGlobal('game', {
		user: { id: opts.currentUserId, isGM: opts.currentUserIsGM },
		users: { activeGM: opts.activeGmId ? { id: opts.activeGmId } : null },
		nimble: {
			conditions: {
				getConditionsToRemove: vi.fn(() => ['hampered']),
				shouldRemoveTriggeredCondition: vi.fn(() => true),
			},
		},
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('handleAutomaticConditionApplication.postCreate', () => {
	let actor: MockActor;

	beforeEach(() => {
		actor = createActor();
	});

	it('applies the automatic condition when run on the active GM client', async () => {
		stubGame({ currentUserId: 'gm-1', currentUserIsGM: true, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postCreate(
			document as never,
			{ automaticConditionsToApply: ['hampered'] } as never,
			'gm-1',
		);

		expect(actor.toggleStatusEffect).toHaveBeenCalledTimes(1);
		expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
			'hampered',
			expect.objectContaining({ automaticConditionSource: 'effect-1' }),
		);
	});

	it('does NOT apply the condition on a non-GM player client', async () => {
		stubGame({ currentUserId: 'player-1', currentUserIsGM: false, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postCreate(
			document as never,
			{ automaticConditionsToApply: ['hampered'] } as never,
			'gm-1',
		);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does NOT apply the condition on a second, non-active GM client', async () => {
		stubGame({ currentUserId: 'gm-2', currentUserIsGM: true, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postCreate(
			document as never,
			{ automaticConditionsToApply: ['hampered'] } as never,
			'gm-1',
		);

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('falls back to any connected GM when no active GM is designated', async () => {
		stubGame({ currentUserId: 'gm-1', currentUserIsGM: true, activeGmId: null });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postCreate(
			document as never,
			{ automaticConditionsToApply: ['hampered'] } as never,
			'gm-1',
		);

		expect(actor.toggleStatusEffect).toHaveBeenCalledTimes(1);
	});

	it('does nothing when there are no conditions to apply', async () => {
		stubGame({ currentUserId: 'gm-1', currentUserIsGM: true, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postCreate(document as never, {} as never, 'gm-1');

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});

describe('handleAutomaticConditionApplication.postDelete', () => {
	let actor: MockActor;

	beforeEach(() => {
		actor = createActor();
	});

	it('removes the automatic condition when run on the active GM client', async () => {
		stubGame({ currentUserId: 'gm-1', currentUserIsGM: true, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postDelete(document as never, {} as never, 'gm-1');

		expect(actor.toggleStatusEffect).toHaveBeenCalledWith(
			'hampered',
			expect.objectContaining({ active: false }),
		);
	});

	it('does NOT remove the condition on a non-GM player client', async () => {
		stubGame({ currentUserId: 'player-1', currentUserIsGM: false, activeGmId: 'gm-1' });
		const document = createDocument(actor);

		await handleAutomaticConditionApplication.postDelete(document as never, {} as never, 'gm-1');

		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});
