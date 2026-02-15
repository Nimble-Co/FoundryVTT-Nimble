import { vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
	type CombatActorFixtureOptions,
	type CombatantFixtureOptions,
} from '../fixtures/combat.js';

type HookCallback = (...args: unknown[]) => unknown;

type CombatDefeatSyncTestGlobals = {
	Hooks: {
		on: ReturnType<typeof vi.fn>;
	};
	game: {
		user: {
			isGM: boolean;
		};
		combats: {
			contents: Combat[];
		};
	};
	foundry: {
		utils: {
			hasProperty: (obj: unknown, path: string) => boolean;
		};
	};
	CONFIG: {
		specialStatusEffects: {
			DEFEATED: string;
		};
	};
};

type NimbleCombatDocumentTestGlobals = {
	game: {
		user: {
			isGM: boolean;
			role?: number;
		};
	};
	fromUuidSync: ReturnType<typeof vi.fn>;
	SortingHelpers: {
		performIntegerSort: ReturnType<typeof vi.fn>;
	};
	foundry: {
		applications: {
			ux: {
				TextEditor: {
					implementation: {
						getDragEventData: ReturnType<typeof vi.fn>;
					};
				};
			};
		};
	};
	Combat: {
		prototype: Record<string, unknown>;
	};
};

type MockCombatantOptions = CombatantFixtureOptions & {
	updateResult?: unknown;
};

type MockCombatOptions = {
	id: string;
	combatants: Combatant.Implementation[];
	turns: Combatant.Implementation[];
	activeCombatant: Combatant.Implementation | null;
	round: number;
};

type DropEventOptions = {
	sourceId: string;
	targetId: string;
	before: boolean;
};

export type { CombatDefeatSyncTestGlobals, HookCallback, NimbleCombatDocumentTestGlobals };

export function getTestGlobals<T>() {
	return globalThis as unknown as T;
}

export function createHasPropertyMock(): (obj: unknown, path: string) => boolean {
	return (obj: unknown, path: string): boolean => {
		const keys = path.split('.');
		let current = obj as Record<string, unknown> | undefined;
		for (const key of keys) {
			if (!current || typeof current !== 'object' || !(key in current)) return false;
			current = current[key] as Record<string, unknown> | undefined;
		}
		return true;
	};
}

export function createHookCapture(hooksOnMock: ReturnType<typeof vi.fn>) {
	const callbacks = new Map<string, HookCallback>();
	hooksOnMock.mockImplementation((event: string, callback: HookCallback) => {
		callbacks.set(event, callback);
		return 1;
	});
	return callbacks;
}

export function createMockCombatActor(
	options: CombatActorFixtureOptions = {},
): Actor.Implementation & { toggleStatusEffect: ReturnType<typeof vi.fn> } {
	const actor = createCombatActorFixture(options) as Actor.Implementation & {
		toggleStatusEffect: ReturnType<typeof vi.fn>;
	};
	actor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
	return actor;
}

export function createMockCombatant(
	options: MockCombatantOptions = {},
): Combatant.Implementation & { update: ReturnType<typeof vi.fn> } {
	const combatant = createCombatantFixture(options) as Combatant.Implementation & {
		update: ReturnType<typeof vi.fn>;
	};
	const defaultUpdateResult = { id: combatant.id };
	combatant.update = vi.fn().mockResolvedValue(options.updateResult ?? defaultUpdateResult);
	return combatant;
}

export function createMockCombat({
	id,
	combatants,
	turns,
	activeCombatant,
	round,
}: MockCombatOptions): Combat & {
	updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
	nextTurn: ReturnType<typeof vi.fn>;
} {
	return {
		id,
		combatants: { contents: combatants },
		turns,
		combatant: activeCombatant,
		round,
		updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
		nextTurn: vi.fn().mockResolvedValue(undefined),
	} as unknown as Combat & {
		updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		nextTurn: ReturnType<typeof vi.fn>;
	};
}

export function createCombatDropEvent({
	sourceId,
	targetId,
	before,
}: DropEventOptions): DragEvent & { target: EventTarget & HTMLElement } {
	const trackerListElement = {
		dataset: {
			dragSourceId: sourceId,
			dropTargetId: targetId,
			dropBefore: String(before),
		},
		querySelector: vi.fn(),
	} as unknown as HTMLElement;

	const eventTarget = {
		closest: vi.fn((selector: string) => {
			if (selector === '.nimble-combatants') return trackerListElement;
			return null;
		}),
	} as unknown as HTMLElement;

	return {
		preventDefault: vi.fn(),
		target: eventTarget,
		y: 0,
	} as unknown as DragEvent & { target: EventTarget & HTMLElement };
}
