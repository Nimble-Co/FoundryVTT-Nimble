import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../../../tests/fixtures/combat.js';
import { createMockCombatant } from '../../../../tests/mocks/combat.js';
import { buildMinionAttackRollEntry } from '../combatMinionAttacks.js';

describe('buildMinionAttackRollEntry', () => {
	it('names the Held Changes the roll used, for the row on the group card', () => {
		const entry = buildMinionAttackRollEntry({
			member: { name: 'Goblin' } as never,
			memberId: 'm1',
			selectedActionId: 'a1',
			selectedAction: { name: 'Stab' },
			formula: '1d4',
			damageRoll: { isMiss: false, total: 3, toJSON: () => ({}) } as never,
			held: [{ label: 'Create an Opening', value: 1 }] as never,
			mustAttackLabel: 'Addling Arrow',
		});

		expect(entry.mustAttackLabel).toBe('Addling Arrow');
		expect(entry.primaryDieBonuses).toEqual([{ label: 'Create an Opening', value: 1 }]);
	});
});

describe('performMinionGroupAttack Lasts Until events', () => {
	const fireAttackEvents = vi.fn((..._args: unknown[]) => Promise.resolve());
	let performMinionGroupAttack: typeof import('../combatMinionAttacks.js').performMinionGroupAttack;

	// Setup loads this module through game.ts, so a hoisted vi.mock would miss it.
	beforeAll(async () => {
		vi.resetModules();
		vi.doMock('#utils/lastsUntil/lastsUntilEvents.js', () => ({ fireAttackEvents }));
		vi.doMock('../combatCommon.js', async (importOriginal) => ({
			...(await importOriginal<typeof import('../combatCommon.js')>()),
			buildNcsGroupAttackChatData: () => ({}),
		}));
		({ performMinionGroupAttack } = await import('../combatMinionAttacks.js'));
	});

	const gameGlobal = (globalThis as unknown as { game: { user: unknown } }).game;
	let savedUser: unknown;

	beforeEach(() => {
		fireAttackEvents.mockClear();
		savedUser = gameGlobal.user;
		gameGlobal.user = { isGM: true, targets: new Set([{ id: 'target-1', name: 'Target' }]) };
		vi.stubGlobal('ChatMessage', {
			create: vi.fn().mockResolvedValue({ id: 'card' }),
			getSpeaker: vi.fn().mockReturnValue({}),
			applyMode: vi.fn(),
		});
	});

	afterEach(() => {
		gameGlobal.user = savedUser;
		vi.unstubAllGlobals();
	});

	function minionActor(id: string, damage = true) {
		return {
			...createCombatActorFixture({ id, hp: 1 }),
			type: 'minion',
			items: [
				{
					id: `${id}-action`,
					type: 'monsterFeature',
					name: 'Stab',
					system: {
						subtype: 'action',
						activation: {
							cost: { type: 'action', quantity: 1 },
							effects: damage ? [{ type: 'damage', formula: '1' }] : [],
						},
					},
				},
			],
		} as unknown as Actor.Implementation;
	}

	function member(id: string, actor: Actor.Implementation) {
		return createMockCombatant({ id, type: 'npc', actionsCurrent: 1, actor, combatId: 'c1' });
	}

	function attackCombat(members: Combatant.Implementation[]) {
		return {
			id: 'c1',
			combatants: createCombatantsCollectionFixture(members),
			combatant: members[0],
			updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
			nextTurn: vi.fn(),
		};
	}

	async function attack(
		members: Combatant.Implementation[],
		{ endTurn = false, combat = attackCombat(members) } = {},
	) {
		return performMinionGroupAttack({
			combat: combat as unknown as Combat,
			attackParams: {
				memberCombatantIds: members.map((each) => each.id ?? ''),
				targetTokenIds: ['target-1'],
				selections: members.map((each) => ({
					memberCombatantId: each.id ?? '',
					actionId: `${each.actor?.id}-action`,
				})),
				endTurn,
			},
			assignNcsTemporaryGroupFromAttackMembers: vi.fn(),
		});
	}

	it('fires the attack event once for each member actor that rolled', async () => {
		const actorA = minionActor('a');
		const actorB = minionActor('b');
		const actorC = minionActor('c', false);

		const result = await attack([
			member('m-a', actorA),
			member('m-b', actorB),
			member('m-c', actorC),
		]);

		expect(result.rolledCombatantIds).toEqual(['m-a', 'm-b']);
		expect(fireAttackEvents).toHaveBeenCalledTimes(2);
		expect(fireAttackEvents).toHaveBeenCalledWith(actorA, { id: 'card' });
		expect(fireAttackEvents).toHaveBeenCalledWith(actorB, { id: 'card' });
	});

	it('ends the turn only after the activity of the attack is saved', async () => {
		const actor = minionActor('a');
		const members = [member('m-a', actor)];
		const combat = attackCombat(members);
		let saved = false;
		fireAttackEvents.mockImplementationOnce(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
			saved = true;
		});
		combat.nextTurn.mockImplementation(() => expect(saved).toBe(true));

		const result = await attack(members, { endTurn: true, combat });

		expect(result.endTurnApplied).toBe(true);
		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
	});

	it('fires it once for an actor that two members share', async () => {
		const shared = minionActor('shared');

		await attack([member('m-1', shared), member('m-2', shared)]);

		expect(fireAttackEvents).toHaveBeenCalledTimes(1);
		expect(fireAttackEvents).toHaveBeenCalledWith(shared, { id: 'card' });
	});

	it('does not end the Despair of a member itself: the attack event ends it', async () => {
		const actor = Object.assign(minionActor('despairing'), {
			getDomain: vi.fn(() => new Set(['self:despair'])),
			toggleStatusEffect: vi.fn(),
		});
		const action = (actor.items as unknown as { system: { activation: object } }[])[0];
		action.system.activation = {
			cost: { type: 'action', quantity: 1 },
			targets: { attackType: 'reach' },
			effects: [{ type: 'damage', formula: '1', canMiss: true }],
		};

		await attack([member('m-d', actor)]);

		expect(actor.getDomain).toHaveBeenCalled();
		expect(fireAttackEvents).toHaveBeenCalledWith(actor, { id: 'card' });
		expect(actor.toggleStatusEffect).not.toHaveBeenCalled();
	});
});
