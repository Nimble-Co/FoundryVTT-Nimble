import { vi } from 'vitest';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { AUTOMATION_SETTING_KEYS } from '../../src/settings/automationSettings.js';
import { createCombatantsCollectionFixture } from './combat.js';

export type HeroicTestGlobals = {
	canvas: unknown;
	ChatMessage: {
		create: ReturnType<typeof vi.fn>;
		getSpeaker: ReturnType<typeof vi.fn>;
	};
	CONFIG: { sounds?: unknown };
	CONST: { CHAT_MESSAGE_STYLES?: unknown };
	foundry: { applications: { api: { DialogV2: { confirm: ReturnType<typeof vi.fn> } } } };
	game: {
		combat: unknown;
		combats: unknown;
		settings?: unknown;
		user: { id?: string; isGM?: boolean; targets: Set<unknown> };
	};
	ui: { notifications: { warn: ReturnType<typeof vi.fn> } };
};

export function heroicGlobals(): HeroicTestGlobals {
	return globalThis as unknown as HeroicTestGlobals;
}

export function createHeroicCharacter(overrides: Record<string, unknown> = {}): NimbleCharacter {
	return {
		id: 'heroic-actor',
		name: 'Heroic Tester',
		type: 'character',
		isOwner: true,
		img: 'hero.webp',
		permission: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		getRollData: () => ({}),
		reactive: { system: { attributes: { armor: { value: 15 } } } },
		...overrides,
	} as unknown as NimbleCharacter;
}

export function createHeroicCombatant(
	actor: NimbleCharacter,
	options: { currentActions?: number; opportunityAttackAvailable?: boolean } = {},
) {
	return {
		id: 'heroic-combatant',
		actorId: actor.id,
		actor,
		type: 'character',
		initiative: 12,
		system: {
			actions: {
				base: { current: options.currentActions ?? 2, max: 3 },
				heroic: {
					defendAvailable: true,
					interposeAvailable: true,
					helpAvailable: true,
					opportunityAttackAvailable: options.opportunityAttackAvailable ?? true,
				},
			},
		},
		update: vi.fn().mockResolvedValue(undefined),
	};
}

/** Puts the combatant in a started combat on the current scene, off its own turn. */
export function setHeroicCombat(
	combatant: ReturnType<typeof createHeroicCombatant>,
	extra: Record<string, unknown> = {},
) {
	const activeCombatant = { id: 'active-combatant', actorId: 'other-actor', initiative: 15 };
	const combat = {
		id: 'heroic-combat',
		scene: { id: 'heroic-scene' },
		active: true,
		started: true,
		round: 1,
		combatant: activeCombatant,
		combatants: createCombatantsCollectionFixture([
			combatant,
			activeCombatant,
		] as unknown as Combatant.Implementation[]),
		...extra,
	};
	heroicGlobals().canvas = { scene: { id: 'heroic-scene' } };
	heroicGlobals().game.combat = combat;
	heroicGlobals().game.combats = { contents: [combat], viewed: combat };
	return combat;
}

export function clearHeroicCombat() {
	heroicGlobals().canvas = { scene: { id: 'heroic-scene' } };
	heroicGlobals().game.combat = null;
	heroicGlobals().game.combats = { contents: [], viewed: null };
}

export function setActionTracking(enabled: boolean) {
	heroicGlobals().game.settings = {
		get: vi.fn(
			(_namespace: string, key: string) =>
				key !== AUTOMATION_SETTING_KEYS.actionTracking || enabled,
		),
	};
}

/** Resets chat, notifications, dialogs and targets; returns a restore function. */
export function resetHeroicGlobals(): () => void {
	const globals = heroicGlobals();
	const previousSettings = globals.game.settings;
	globals.ChatMessage.create = vi.fn().mockResolvedValue({ id: 'chat-message-id' });
	globals.ChatMessage.getSpeaker = vi.fn().mockReturnValue({});
	globals.ui.notifications.warn = vi.fn();
	globals.foundry.applications.api.DialogV2.confirm = vi.fn().mockResolvedValue(true);
	globals.game.user.targets = new Set();
	globals.CONST.CHAT_MESSAGE_STYLES ??= { OTHER: 0 };
	globals.CONFIG.sounds ??= { dice: '' };
	clearHeroicCombat();
	setActionTracking(true);
	return () => {
		globals.game.settings = previousSettings;
	};
}

export function targetToken(uuid: string, name = 'Goblin') {
	return { name, actor: { id: `${uuid}-actor`, name }, document: { uuid } };
}
