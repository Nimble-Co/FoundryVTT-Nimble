import { afterEach, describe, expect, it, vi } from 'vitest';
import { findActorToken } from './findActorToken.js';

const viewedScene = { id: 'viewed' };
const activeScene = { id: 'active' };
const otherScene = { id: 'other' };

function token(id: string, parent: { id: string }) {
	return { id, parent } as unknown as TokenDocument;
}

function worldActor(tokens: TokenDocument[]) {
	return {
		isToken: false,
		getDependentTokens: vi.fn(() => tokens),
		getActiveTokens: vi.fn(() => []),
	};
}

function stubWorld({
	viewed = viewedScene as object | null,
	active = activeScene as object | null,
	combats = [] as object[],
} = {}) {
	vi.stubGlobal('game', {
		...(globalThis as unknown as { game: object }).game,
		scenes: { viewed, active },
		combats,
	});
}

describe('findActorToken', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns null without an actor', () => {
		expect(findActorToken(null)).toBeNull();
		expect(findActorToken(undefined)).toBeNull();
	});

	it("returns a synthetic actor's own token", () => {
		stubWorld();
		const own = token('own', otherScene);
		const actor = { isToken: true, token: own, getDependentTokens: vi.fn() };
		expect(findActorToken(actor as unknown as Actor)).toBe(own);
		expect(actor.getDependentTokens).not.toHaveBeenCalled();
	});

	it('asks for the linked tokens that exist in their scene, on every scene', () => {
		stubWorld();
		const actor = worldActor([]);
		findActorToken(actor as unknown as Actor);
		expect(actor.getDependentTokens).toHaveBeenCalledWith({ linked: true, concreteOnly: true });
	});

	it('prefers its token in a started combat over one on the viewed scene', () => {
		const onViewed = token('a', viewedScene);
		const inCombat = token('b', otherScene);
		stubWorld({ combats: [{ started: true, combatants: [{ tokenId: 'b', sceneId: 'other' }] }] });
		expect(findActorToken(worldActor([onViewed, inCombat]) as unknown as Actor)).toBe(inCombat);
	});

	it('does not count a combat that has not started', () => {
		const onViewed = token('a', viewedScene);
		const inCombat = token('b', otherScene);
		stubWorld({ combats: [{ started: false, combatants: [{ tokenId: 'b', sceneId: 'other' }] }] });
		expect(findActorToken(worldActor([inCombat, onViewed]) as unknown as Actor)).toBe(onViewed);
	});

	it('then the viewed scene, then the active scene, then any scene', () => {
		const onOther = token('o', otherScene);
		const onActive = token('act', activeScene);
		const onViewed = token('v', viewedScene);

		stubWorld();
		expect(findActorToken(worldActor([onOther, onActive, onViewed]) as unknown as Actor)).toBe(
			onViewed,
		);
		expect(findActorToken(worldActor([onOther, onActive]) as unknown as Actor)).toBe(onActive);
		expect(findActorToken(worldActor([onOther]) as unknown as Actor)).toBe(onOther);
	});

	it('works with no viewed scene, as on a client with no canvas', () => {
		const onOther = token('o', otherScene);
		const onActive = token('act', activeScene);
		stubWorld({ viewed: null });
		expect(findActorToken(worldActor([onOther, onActive]) as unknown as Actor)).toBe(onActive);
		stubWorld({ viewed: null, active: null });
		expect(findActorToken(worldActor([onOther]) as unknown as Actor)).toBe(onOther);
	});

	it('does not read the canvas', () => {
		stubWorld();
		const actor = worldActor([token('o', otherScene)]);
		findActorToken(actor as unknown as Actor);
		expect(actor.getActiveTokens).not.toHaveBeenCalled();
	});

	it('returns null when the actor has no token', () => {
		stubWorld();
		expect(findActorToken(worldActor([]) as unknown as Actor)).toBeNull();
	});
});
