import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCombatantFixture } from '../../../../tests/fixtures/combat.js';
import { NimbleBaseActor } from '../../actor/base.svelte.js';
import { rollInitiativeForCombatant } from '../combatInitiative.js';

type Globals = Record<string, any>;
const globals = globalThis as Globals;

function d20Roll(d20: number, total: number, formula = '1d20 + 2') {
	const data = { rolls: ['stored-roll'], speaker: { alias: 'Pip' }, sound: 'dice' };
	return {
		formula,
		total,
		terms: [{ faces: 20, results: [{ result: d20, active: true }] }],
		evaluate: vi.fn().mockResolvedValue(null),
		toMessage: vi.fn(async (messageData: Record<string, unknown>) => ({ ...data, ...messageData })),
	};
}

function postInCombat(
	roll: ReturnType<typeof d20Roll>,
	overrides: Partial<Parameters<typeof createCombatantFixture>[0]> = {},
) {
	const actor = {
		uuid: 'Actor.pip',
		id: 'pip',
		name: 'Pip',
		type: 'character',
		permission: 3,
		rules: [],
	};
	const combatant = Object.assign(
		createCombatantFixture({
			id: 'combatant-pip',
			type: 'character',
			isOwner: true,
			actor: actor as never,
			...overrides,
		}),
		{ getInitiativeRoll: vi.fn(() => roll), name: 'Pip the Bold' },
	);
	return rollInitiativeForCombatant({
		combat: { id: 'combat-1', combatants: new Map([[combatant.id, combatant]]) } as never,
		combatantId: combatant.id as string,
		formula: null,
		messageOptions: {} as never,
		rollIndex: 0,
		combatManaUpdates: [],
	});
}

describe('the Initiative card in a combat', () => {
	beforeEach(() => {
		vi.stubGlobal('ChatMessage', { getSpeaker: vi.fn(() => ({ alias: 'Pip the Bold' })) });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('posts as a card with the core flag, the speaker, the roll and its sound', async () => {
		const roll = d20Roll(5, 7);
		const outcome = await postInCombat(roll);
		const chatData = outcome?.chatData as unknown as Record<string, any>;

		expect(chatData.type).toBe('initiative');
		expect(chatData.flags).toEqual({ 'core.initiativeRoll': true });
		expect(chatData.rolls).toEqual(['stored-roll']);
		expect(chatData.sound).toBe('dice');
		expect(chatData.speaker).toBeTruthy();
		expect(roll.toMessage).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ create: false }),
		);
		expect(chatData.system).toMatchObject({
			actorName: 'Pip the Bold',
			actorType: 'character',
			actorUuid: 'Actor.pip',
			combatId: 'combat-1',
			combatantId: 'combatant-pip',
			foldedActionDelta: 0,
			rollMode: 0,
		});
	});

	it('keeps a hidden combatant private to the GM', async () => {
		const roll = d20Roll(5, 7);
		const actor = { uuid: 'Actor.pip', name: 'Pip', type: 'character', rules: [] };
		const combatant = Object.assign(
			createCombatantFixture({ type: 'character', isOwner: true, actor: actor as never }),
			{ getInitiativeRoll: vi.fn(() => roll), hidden: true },
		);
		await rollInitiativeForCombatant({
			combat: { id: 'c', combatants: new Map([[combatant.id, combatant]]) } as never,
			combatantId: combatant.id as string,
			formula: null,
			messageOptions: {} as never,
			rollIndex: 0,
			combatManaUpdates: [],
		});

		expect(roll.toMessage).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ messageMode: 'gm' }),
		);
	});

	it('plays one sound for a rolled set', async () => {
		const roll = d20Roll(5, 7);
		const actor = { uuid: 'Actor.pip', name: 'Pip', type: 'character', rules: [] };
		const combatant = Object.assign(
			createCombatantFixture({ type: 'character', isOwner: true, actor: actor as never }),
			{ getInitiativeRoll: vi.fn(() => roll) },
		);
		const outcome = await rollInitiativeForCombatant({
			combat: { id: 'c', combatants: new Map([[combatant.id, combatant]]) } as never,
			combatantId: combatant.id as string,
			formula: null,
			messageOptions: {} as never,
			rollIndex: 1,
			combatManaUpdates: [],
		});

		expect((outcome?.chatData as { sound?: unknown }).sound).toBeNull();
	});

	it('stores the roll mode the formula has', async () => {
		const outcome = await postInCombat(d20Roll(15, 17, '3d20khn + 2'));

		expect((outcome?.chatData as unknown as Record<string, any>).system.rollMode).toBe(2);
	});

	it('gives 3 actions on a natural 20 with a total below 20', async () => {
		const outcome = await postInCombat(d20Roll(20, 19, '1d20 - 1'));

		expect(outcome?.combatantUpdate).toMatchObject({
			initiative: 19,
			'system.actions.base.current': 3,
		});
	});

	it('stores the pending adjustment the roll folds in, and clears it', async () => {
		const outcome = await postInCombat(d20Roll(5, 7), { actionsPendingDelta: -2 });

		expect(outcome?.combatantUpdate).toMatchObject({
			'system.actions.base.current': 0,
			'system.actions.pendingDelta': 0,
		});
		expect((outcome?.chatData as unknown as Record<string, any>).system.foldedActionDelta).toBe(-2);
	});
});

describe('the Initiative card out of a combat', () => {
	let previousCombat: unknown;
	let create: ReturnType<typeof vi.fn>;
	let applyMode: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		previousCombat = globals.game.combat;
		create = vi.fn(async (data: unknown) => data);
		applyMode = vi.fn();
		vi.stubGlobal('ChatMessage', {
			getSpeaker: vi.fn(() => ({ alias: 'Pip' })),
			applyMode,
			create,
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		globals.game.combat = previousCombat;
	});

	function post(roll: ReturnType<typeof d20Roll>) {
		vi.stubGlobal('Roll', { create: vi.fn(() => roll) });
		const actor = {
			id: 'pip',
			uuid: 'Actor.pip',
			name: 'Pip',
			type: 'character',
			permission: 3,
			rules: [],
			getRollData: () => ({}),
			resolveInitiativeRollData: vi.fn(async () => ({
				rollFormula: roll.formula,
				rollMode: 0,
				visibilityMode: 'gmroll',
			})),
		};
		return NimbleBaseActor.prototype.rollInitiativeToChat.call(actor as never);
	}

	it('posts the card with the core flag, the speaker and the message mode, and no combat', async () => {
		globals.game.combat = null;
		await post(d20Roll(5, 7));

		const chatData = create.mock.calls[0][0] as Record<string, any>;
		expect(chatData.type).toBe('initiative');
		expect(chatData.flags).toEqual({ core: { initiativeRoll: true } });
		expect(chatData.speaker).toEqual({ alias: 'Pip' });
		expect(chatData.rolls).toEqual(['stored-roll']);
		expect(applyMode).toHaveBeenCalledWith(chatData, 'gm');
		expect(chatData.system).toMatchObject({
			actorType: 'character',
			actorUuid: 'Actor.pip',
			combatId: null,
			combatantId: null,
		});
	});

	it('stores the combat and combatant when the actor is in one', async () => {
		globals.game.combat = {
			id: 'combat-1',
			getCombatantByActor: vi.fn(() => ({ id: 'combatant-pip' })),
		};
		vi.stubGlobal('Hooks', { callAll: vi.fn() });
		await post(d20Roll(5, 7));

		expect((create.mock.calls[0][0] as Record<string, any>).system).toMatchObject({
			combatId: 'combat-1',
			combatantId: 'combatant-pip',
		});
	});
});
