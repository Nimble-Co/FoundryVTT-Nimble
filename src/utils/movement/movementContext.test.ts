import { describe, expect, it, vi } from 'vitest';
import {
	type ContextCard,
	type ContextToken,
	type MovementContextLookups,
	reconcileMovementContext,
} from './movementContext.js';

const scene = { id: 'scene1' };
const otherScene = { id: 'scene2' };

function makeToken(name: string, x: number, parent: { id: string } = scene): ContextToken {
	return {
		name,
		x,
		y: 0,
		width: 1,
		height: 1,
		parent,
		getOccupiedGridSpaceOffsets: () => [],
	} as unknown as ContextToken;
}

const tokens: Record<string, ContextToken> = {
	'Scene.scene1.Token.hero': makeToken('Hero', 0),
	'Scene.scene1.Token.goblin': makeToken('Goblin', 5),
	'Scene.scene1.Token.ogre': makeToken('Ogre', 1),
	'Scene.scene2.Token.far': makeToken('Far Away', 2, otherScene),
};

const actor = { id: 'actor1' };

function lookups(over: Partial<MovementContextLookups> = {}): MovementContextLookups {
	return {
		resolveToken: (uuid) => tokens[uuid] ?? null,
		measure: (a, b) => Math.abs(a.x - b.x),
		source: actor,
		spacesMovedThisTurn: () => 3,
		trackingEnabled: true,
		...over,
	};
}

function card(targets: string[], system: Partial<ContextCard['system']> = {}): ContextCard {
	return {
		speaker: { scene: 'scene1', token: 'hero', actor: 'actor1' },
		system: { targets, ...system },
	};
}

describe('reconcileMovementContext', () => {
	it('stamps the source spaces moved and how far each target is from the speaker token', () => {
		const context = reconcileMovementContext(
			card(['Scene.scene1.Token.goblin', 'Scene.scene1.Token.ogre']),
			lookups(),
		);
		expect(context).toEqual({
			spacesMovedThisTurn: 3,
			targetsSpacesAway: [
				{ tokenUuid: 'Scene.scene1.Token.goblin', name: 'Goblin', spaces: 5 },
				{ tokenUuid: 'Scene.scene1.Token.ogre', name: 'Ogre', spaces: 1 },
			],
		});
	});

	it('reads spaces moved for the given source actor', () => {
		const spacesMovedThisTurn = vi.fn(() => 2);
		reconcileMovementContext(card([]), lookups({ spacesMovedThisTurn }));
		expect(spacesMovedThisTurn).toHaveBeenCalledWith(actor);
	});

	it('keeps spaces moved null outside combat', () => {
		const context = reconcileMovementContext(
			card([]),
			lookups({ spacesMovedThisTurn: () => null }),
		);
		expect(context.spacesMovedThisTurn).toBeNull();
	});

	it('keeps spaces moved null when movement tracking is off, without reading it', () => {
		const spacesMovedThisTurn = vi.fn(() => 4);
		const context = reconcileMovementContext(
			card([]),
			lookups({ trackingEnabled: false, spacesMovedThisTurn }),
		);
		expect(context.spacesMovedThisTurn).toBeNull();
		expect(spacesMovedThisTurn).not.toHaveBeenCalled();
	});

	it('falls back to the speaker token actor when no source is given', () => {
		const tokenActor = { id: 'tokenActor' };
		const spacesMovedThisTurn = vi.fn(() => 1);
		const withActor = {
			...tokens,
			'Scene.scene1.Token.hero': { ...tokens['Scene.scene1.Token.hero'], actor: tokenActor },
		} as Record<string, ContextToken>;
		reconcileMovementContext(
			card([]),
			lookups({ source: undefined, spacesMovedThisTurn, resolveToken: (uuid) => withActor[uuid] }),
		);
		expect(spacesMovedThisTurn).toHaveBeenCalledWith(tokenActor);
	});

	it('skips a target on another scene or without a token', () => {
		const context = reconcileMovementContext(
			card(['Scene.scene2.Token.far', 'Scene.scene1.Token.gone', 'Scene.scene1.Token.ogre']),
			lookups(),
		);
		expect(context.targetsSpacesAway.map((entry) => entry.name)).toEqual(['Ogre']);
	});

	it('skips every target when the card has no speaker token', () => {
		const context = reconcileMovementContext(
			{
				speaker: { scene: null, token: null, actor: 'actor1' },
				system: { targets: ['Scene.scene1.Token.ogre'] },
			},
			lookups(),
		);
		expect(context).toEqual({ spacesMovedThisTurn: 3, targetsSpacesAway: [] });
	});

	it('skips a target it cannot measure, such as on a scene without a grid', () => {
		const context = reconcileMovementContext(
			card(['Scene.scene1.Token.ogre']),
			lookups({ measure: () => Number.POSITIVE_INFINITY }),
		);
		expect(context.targetsSpacesAway).toEqual([]);
	});

	describe('once stamped', () => {
		const stamped = {
			spacesMovedThisTurn: 3,
			targetsSpacesAway: [{ tokenUuid: 'Scene.scene1.Token.goblin', name: 'Goblin', spaces: 4 }],
		};

		it('keeps the first spaces moved and the first measure of a kept target', () => {
			const spacesMovedThisTurn = vi.fn(() => 6);
			const context = reconcileMovementContext(
				card(['Scene.scene1.Token.goblin'], { movementContext: stamped }),
				lookups({ spacesMovedThisTurn }),
			);
			expect(context).toEqual(stamped);
			expect(spacesMovedThisTurn).not.toHaveBeenCalled();
		});

		it('measures an added target at that moment and drops a removed one', () => {
			const context = reconcileMovementContext(
				card(['Scene.scene1.Token.ogre'], { movementContext: stamped }),
				lookups(),
			);
			expect(context).toEqual({
				spacesMovedThisTurn: 3,
				targetsSpacesAway: [{ tokenUuid: 'Scene.scene1.Token.ogre', name: 'Ogre', spaces: 1 }],
			});
		});

		it('keeps a null spaces moved null', () => {
			const context = reconcileMovementContext(
				card([], { movementContext: { spacesMovedThisTurn: null, targetsSpacesAway: [] } }),
				lookups(),
			);
			expect(context.spacesMovedThisTurn).toBeNull();
		});
	});
});
