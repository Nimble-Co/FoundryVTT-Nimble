import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
} from '../../../../tests/fixtures/combat.js';
import {
	clearExpandedTurnIdentityHint,
	setExpandedTurnIdentityHint,
} from '../../../documents/combat/expandedTurnIdentityStore.js';
import {
	getCombatantCardResourceChips,
	getCombatantOutlineClass,
	getNonPlayerCombatantHpBarData,
	getPlayerCombatantDrawerData,
	shouldRenderCombatantActions,
	syncCombatTurnsForCt,
} from './helpers.js';

describe('ctTopTracker helpers', () => {
	beforeEach(() => {
		clearExpandedTurnIdentityHint('combat-legendary-ct-sync');
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

	it('shows wounds, mana, and heroic reaction chips for players when token bars are visible', () => {
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
		const combatant = createCombatantFixture({ type: 'character', actor });
		(combatant as unknown as { token: TokenDocument }).token = {
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
						};
					};
				};
			}
		).system.actions.heroic = {
			defendAvailable: true,
			interposeAvailable: false,
		};

		const chips = getCombatantCardResourceChips(combatant);

		expect(chips).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ key: 'wounds', text: '2/6' }),
				expect.objectContaining({ key: 'mana', text: '4/7' }),
				expect.objectContaining({ key: 'defend', active: true }),
				expect.objectContaining({ key: 'interpose', active: false }),
			]),
		);
	});

	it('builds the player drawer with bars and reaction state', () => {
		const actor = createCombatActorFixture({
			type: 'character',
			isOwner: false,
			hp: 5,
			hpMax: 10,
			woundsValue: 2,
			woundsMax: 6,
		});
		const combatant = createCombatantFixture({ type: 'character', actor });
		(combatant as unknown as { token: TokenDocument }).token = {
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

		const drawer = getPlayerCombatantDrawerData(combatant, 'hpState');

		expect(drawer.rowCount).toBe(3);
		expect(drawer.hpBar).toEqual(
			expect.objectContaining({
				visible: true,
				fillPercent: 50,
				centerText: 'Bloodied',
				toneClass: 'nimble-ct__player-resource-bar--red',
			}),
		);
		expect(drawer.woundsBar).toEqual(
			expect.objectContaining({
				visible: true,
				fillPercent: 33,
				centerText: '2/6',
				iconClass: 'fa-solid fa-droplet',
			}),
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

	it('collapses the player drawer to reactions when token hp and wounds bars are hidden', () => {
		const actor = createCombatActorFixture({
			type: 'character',
			isOwner: true,
			hp: 9,
			hpMax: 12,
			woundsValue: 1,
			woundsMax: 6,
		});
		const combatant = createCombatantFixture({ type: 'character', actor });
		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 0,
			bar1: { attribute: 'attributes.hp' },
			bar2: { attribute: 'attributes.wounds.value' },
		} as TokenDocument;

		const drawer = getPlayerCombatantDrawerData(combatant, 'percentage');

		expect(drawer.rowCount).toBe(1);
		expect(drawer.hpBar.visible).toBe(false);
		expect(drawer.woundsBar.visible).toBe(false);
	});

	it('builds a non-player hp bar with health state text when hp is visible', () => {
		const actor = createCombatActorFixture({ type: 'npc', isOwner: false, hp: 5, hpMax: 10 });
		const combatant = createCombatantFixture({ type: 'npc', actor });
		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 50,
			bar1: { attribute: 'attributes.hp' },
		} as TokenDocument;

		const hpBar = getNonPlayerCombatantHpBarData(combatant, true, 'hpState');

		expect(hpBar).toEqual(
			expect.objectContaining({
				visible: true,
				fillPercent: 50,
				centerText: 'Bloodied',
				toneClass: 'nimble-ct__non-player-hp-bar--red',
			}),
		);
	});

	it('hides the non-player hp bar when hp is not visible and shows percent when enabled', () => {
		const actor = createCombatActorFixture({ type: 'npc', isOwner: false, hp: 7, hpMax: 10 });
		const combatant = createCombatantFixture({ type: 'npc', actor });
		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 0,
			bar1: { attribute: 'attributes.hp' },
		} as TokenDocument;

		expect(getNonPlayerCombatantHpBarData(combatant, true, 'percentage').visible).toBe(false);

		(combatant as unknown as { token: TokenDocument }).token = {
			displayBars: 50,
			bar1: { attribute: 'attributes.hp' },
		} as TokenDocument;
		expect(getNonPlayerCombatantHpBarData(combatant, true, 'percentage')).toEqual(
			expect.objectContaining({
				visible: true,
				fillPercent: 70,
				centerText: '70%',
			}),
		);
	});

	it('maps outline colors by combatant category', () => {
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

		expect(getCombatantOutlineClass(player)).toBe('nimble-ct__portrait--outline-player');
		expect(getCombatantOutlineClass(friendlyNpc)).toBe('nimble-ct__portrait--outline-friendly');
		expect(getCombatantOutlineClass(monster)).toBe('nimble-ct__portrait--outline-monster');
		expect(getCombatantOutlineClass(solo)).toBe('nimble-ct__portrait--outline-monster');
	});

	it('always renders combatant actions', () => {
		expect(shouldRenderCombatantActions()).toBe(true);
	});

	it('preserves a stored later solo occurrence when syncing CT turns from a raw solo turn index', () => {
		const playerOne = createCombatantFixture({
			id: 'player-one',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const playerTwo = createCombatantFixture({
			id: 'player-two',
			type: 'character',
			actor: createCombatActorFixture({ type: 'character' }),
		});
		const solo = createCombatantFixture({
			id: 'legendary-one',
			type: 'soloMonster',
			actor: createCombatActorFixture({ type: 'soloMonster' }),
		});

		const expandedTurns = [playerOne, solo, playerTwo, solo] as Combatant.Implementation[];
		const rawTurns = [playerOne, playerTwo, solo] as Combatant.Implementation[];
		setExpandedTurnIdentityHint('combat-legendary-ct-sync', {
			combatantId: 'legendary-one',
			occurrence: 1,
		});
		const combat = {
			id: 'combat-legendary-ct-sync',
			turns: rawTurns,
			turn: 2,
			combatant: solo,
			setupTurns: vi.fn(() => expandedTurns),
		} as unknown as Combat & {
			_nimbleExpandedTurnIdentity?: { combatantId: string; occurrence: number | null } | null;
		};

		syncCombatTurnsForCt(combat);

		expect(combat.turn).toBe(3);
		expect(combat._nimbleExpandedTurnIdentity).toEqual({
			combatantId: 'legendary-one',
			occurrence: 1,
		});
	});
});
