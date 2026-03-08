import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../../tests/fixtures/combat.js';
import type { CombatTrackerVisibilityPermissionConfig } from '../../../settings/combatTrackerSettings.js';
import {
	getCombatantCardResourceChips,
	getCombatantHpBadgeText,
	getCombatantOutlineClass,
	getPlayerCombatantDrawerData,
	shouldRenderCombatantActions,
	shouldRenderHpBadge,
} from './helpers.js';

function createVisibilityPermissions(
	overrides: Partial<CombatTrackerVisibilityPermissionConfig> = {},
): CombatTrackerVisibilityPermissionConfig {
	return {
		hpValue: { player: false, trusted: false, assistant: true, gamemaster: true },
		hpState: { player: false, trusted: false, assistant: true, gamemaster: true },
		mana: { player: false, trusted: false, assistant: true, gamemaster: true },
		wounds: { player: false, trusted: false, assistant: true, gamemaster: true },
		actions: { player: true, trusted: true, assistant: true, gamemaster: true },
		defend: { player: true, trusted: true, assistant: true, gamemaster: true },
		interpose: { player: true, trusted: true, assistant: true, gamemaster: true },
		opportunityAttack: { player: true, trusted: true, assistant: true, gamemaster: true },
		help: { player: true, trusted: true, assistant: true, gamemaster: true },
		outline: { player: true, trusted: true, assistant: true, gamemaster: true },
		...overrides,
	};
}

describe('ctTopTracker helpers', () => {
	beforeEach(() => {
		const globals = globalThis as unknown as {
			game: { user: { isGM?: boolean; role?: number } };
			canvas: typeof canvas;
		};
		const constRecord = CONST as unknown as { TOKEN_DISPLAY_MODES?: Record<string, number> };
		globals.game.user = {
			...game.user,
			isGM: false,
			role: 1,
		};
		globals.canvas = {
			scene: {
				tokens: {
					get: vi.fn(() => null),
				},
			},
		} as unknown as typeof canvas;
		constRecord.TOKEN_DISPLAY_MODES = {
			NONE: 0,
			CONTROL: 10,
			OWNER_HOVER: 20,
			HOVER: 30,
			OWNER: 40,
			ALWAYS: 50,
		};
	});

	it('shows a state-only HP badge when HP state is allowed but numeric HP is hidden', () => {
		const actor = createCombatActorFixture({
			type: 'npc',
			isOwner: false,
			hp: 5,
			hpMax: 10,
		});
		const combatant = createCombatantFixture({
			type: 'npc',
			actor,
		});
		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 50,
			bar1: { attribute: 'attributes.hp' },
		} as TokenDocument;

		const visibilityPermissions = createVisibilityPermissions({
			hpState: { player: true, trusted: true, assistant: true, gamemaster: true },
		});

		expect(shouldRenderHpBadge(combatant, visibilityPermissions)).toBe(true);
		expect(getCombatantHpBadgeText(combatant, visibilityPermissions)).toBe('Bloodied');
	});

	it('hides HP when the token hp bar is not visible to non-owners', () => {
		const actor = createCombatActorFixture({
			type: 'npc',
			isOwner: false,
			hp: 5,
			hpMax: 10,
		});
		const combatant = createCombatantFixture({
			type: 'npc',
			actor,
		});
		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 40,
			bar1: { attribute: 'attributes.hp' },
		} as TokenDocument;

		const visibilityPermissions = createVisibilityPermissions({
			hpValue: { player: true, trusted: true, assistant: true, gamemaster: true },
			hpState: { player: true, trusted: true, assistant: true, gamemaster: true },
		});

		expect(shouldRenderHpBadge(combatant, visibilityPermissions)).toBe(false);
		expect(getCombatantHpBadgeText(combatant, visibilityPermissions)).toBeNull();
	});

	it('shows mana and wounds chips when both resources are assigned to visible token bars', () => {
		const actor = createCombatActorFixture({
			type: 'character',
			isOwner: false,
			hp: 10,
			hpMax: 10,
			woundsValue: 2,
			woundsMax: 6,
			manaValue: 4,
			manaMax: 7,
		});
		const combatant = createCombatantFixture({
			type: 'character',
			actor,
		});
		(
			combatant as unknown as {
				token: TokenDocument;
				system: {
					actions: {
						heroic?: {
							defendAvailable?: boolean;
							interposeAvailable?: boolean;
							opportunityAttackAvailable?: boolean;
							helpAvailable?: boolean;
						};
					};
				};
			}
		).token = {
			displayBars: 50,
			bar1: { attribute: 'resources.mana' },
			bar2: { attribute: 'attributes.wounds.value' },
		} as TokenDocument;
		(
			combatant as unknown as {
				system: {
					actions: {
						heroic?: {
							defendAvailable?: boolean;
							interposeAvailable?: boolean;
							opportunityAttackAvailable?: boolean;
							helpAvailable?: boolean;
						};
					};
				};
			}
		).system.actions.heroic = {
			defendAvailable: true,
			interposeAvailable: false,
			opportunityAttackAvailable: true,
			helpAvailable: true,
		};

		const chips = getCombatantCardResourceChips(
			combatant,
			createVisibilityPermissions({
				mana: { player: true, trusted: true, assistant: true, gamemaster: true },
				wounds: { player: true, trusted: true, assistant: true, gamemaster: true },
				defend: { player: false, trusted: false, assistant: false, gamemaster: false },
				interpose: { player: false, trusted: false, assistant: false, gamemaster: false },
			}),
		);

		expect(chips).toEqual([
			expect.objectContaining({ key: 'wounds', text: '2/6' }),
			expect.objectContaining({ key: 'mana', text: '4/7' }),
		]);
	});

	it('builds the player drawer with hp, wounds, and real heroic reaction state', () => {
		const actor = createCombatActorFixture({
			type: 'character',
			isOwner: false,
			hp: 5,
			hpMax: 10,
			woundsValue: 2,
			woundsMax: 6,
		});
		const combatant = createCombatantFixture({
			type: 'character',
			actor,
		});
		(
			combatant as unknown as {
				token: TokenDocument;
				system: {
					actions: {
						heroic?: {
							defendAvailable?: boolean;
							interposeAvailable?: boolean;
							opportunityAttackAvailable?: boolean;
							helpAvailable?: boolean;
						};
					};
				};
			}
		).token = {
			displayBars: 50,
			bar1: { attribute: 'attributes.hp' },
			bar2: { attribute: 'attributes.wounds.value' },
		} as TokenDocument;
		(
			combatant as unknown as {
				system: {
					actions: {
						heroic?: {
							defendAvailable?: boolean;
							interposeAvailable?: boolean;
							opportunityAttackAvailable?: boolean;
							helpAvailable?: boolean;
						};
					};
				};
			}
		).system.actions.heroic = {
			defendAvailable: true,
			interposeAvailable: false,
			opportunityAttackAvailable: false,
			helpAvailable: true,
		};

		const drawer = getPlayerCombatantDrawerData(
			combatant,
			createVisibilityPermissions({
				hpValue: { player: true, trusted: true, assistant: true, gamemaster: true },
				wounds: { player: true, trusted: true, assistant: true, gamemaster: true },
				defend: { player: true, trusted: true, assistant: true, gamemaster: true },
				interpose: { player: true, trusted: true, assistant: true, gamemaster: true },
				opportunityAttack: {
					player: true,
					trusted: true,
					assistant: true,
					gamemaster: true,
				},
				help: { player: true, trusted: true, assistant: true, gamemaster: true },
			}),
		);

		expect(drawer.hp).toEqual(expect.objectContaining({ visible: true, text: '5/10' }));
		expect(drawer.wounds).toEqual(
			expect.objectContaining({ visible: true, text: '2/6', iconClass: 'fa-solid fa-droplet' }),
		);
		expect(drawer.defend).toEqual(expect.objectContaining({ visible: true, active: true }));
		expect(drawer.interpose).toEqual(expect.objectContaining({ visible: true, active: false }));
		expect(drawer.opportunityAttack).toEqual(
			expect.objectContaining({ visible: true, active: false, iconClass: 'fa-solid fa-bolt' }),
		);
		expect(drawer.help).toEqual(
			expect.objectContaining({ visible: true, active: true, iconClass: 'fa-solid fa-handshake' }),
		);
	});

	it('maps outline colors by combatant category', () => {
		const visibilityPermissions = createVisibilityPermissions();
		const player = createCombatantFixture({
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const friendlyNpc = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
		});
		(friendlyNpc as unknown as { token: TokenDocument }).token = {
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
		} as TokenDocument;
		const monster = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc' }),
		});
		(monster as unknown as { token: TokenDocument }).token = {
			disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
		} as TokenDocument;
		const solo = createCombatantFixture({
			type: 'soloMonster',
			actor: createCombatActorFixture({ type: 'soloMonster' }),
		});

		expect(getCombatantOutlineClass(player, visibilityPermissions)).toBe(
			'nimble-ct__portrait--outline-player',
		);
		expect(getCombatantOutlineClass(friendlyNpc, visibilityPermissions)).toBe(
			'nimble-ct__portrait--outline-friendly',
		);
		expect(getCombatantOutlineClass(monster, visibilityPermissions)).toBe(
			'nimble-ct__portrait--outline-monster',
		);
		expect(getCombatantOutlineClass(solo, visibilityPermissions)).toBe(
			'nimble-ct__portrait--outline-monster',
		);
	});

	it('always shows actions for owners even when the role visibility is disabled', () => {
		const hiddenActions = createVisibilityPermissions({
			actions: { player: false, trusted: false, assistant: false, gamemaster: false },
		});
		const nonOwnerCombatant = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc', isOwner: false }),
		});
		const ownerCombatant = createCombatantFixture({
			type: 'npc',
			actor: createCombatActorFixture({ type: 'npc', isOwner: true }),
		});

		expect(shouldRenderCombatantActions(nonOwnerCombatant, hiddenActions)).toBe(false);
		expect(shouldRenderCombatantActions(ownerCombatant, hiddenActions)).toBe(true);
	});
});
