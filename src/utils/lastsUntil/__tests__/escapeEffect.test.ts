import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const consumeCombatantAction = vi.fn();
let escapeModule: typeof import('../escapeEffect.js');

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/combat/combatTurnActions.js', () => ({ consumeCombatantAction }));
	escapeModule = await import('../escapeEffect.js');
});

function saveCard(total: number, natural = 10) {
	return {
		type: 'savingThrow',
		system: { dc: 13, rollType: 'save', saveKey: 'strength' },
		rolls: [{ total, terms: [{ faces: 20, results: [{ result: natural, active: true }] }] }],
	};
}

function grappled(saves = 'strOrDex') {
	return {
		id: 'grab',
		name: 'Grappled',
		system: { escape: { dc: '13', saves } },
		delete: vi.fn(async () => undefined),
	};
}

function holder(effect: ReturnType<typeof grappled>, card: unknown) {
	return {
		uuid: 'Actor.hero',
		allApplicableEffects: () => [effect],
		rollSavingThrowToChat: vi.fn(async () => card),
	};
}

const wait = vi.fn();

beforeEach(() => {
	consumeCombatantAction.mockReset();
	wait.mockReset().mockResolvedValue('dexterity');
	(foundry.applications as unknown as { api: object }).api = {
		...(foundry.applications as unknown as { api: object }).api,
		DialogV2: { wait },
	};
	const combatant = { id: 'c1', actor: { uuid: 'Actor.hero' } };
	(game as unknown as { combat: unknown }).combat = { started: true, combatants: [combatant] };
});

afterEach(() => {
	(game as unknown as { combat: unknown }).combat = null;
});

describe('escapeSavesOf and escapeDcOf', () => {
	it('reads the allowed saves and a DC that is a number', () => {
		expect(escapeModule.escapeSavesOf('strOrDex')).toEqual(['strength', 'dexterity']);
		expect(escapeModule.escapeSavesOf('will')).toEqual(['will']);
		expect(escapeModule.escapeSavesOf('any')).toHaveLength(4);
		expect(escapeModule.escapeDcOf(' 13 ')).toBe(13);
		expect(escapeModule.escapeDcOf('10 + @key')).toBeNull();
		expect(escapeModule.escapeDcOf('')).toBeNull();
	});
});

describe('escapeEffect', () => {
	it('rolls the picked save, spends 1 action, and removes the effect on a success', async () => {
		const effect = grappled();
		const actor = holder(effect, saveCard(15));

		const result = await escapeModule.escapeEffect(actor as never, 'grab');

		expect(wait).toHaveBeenCalled();
		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('dexterity', { dc: 13 });
		expect(consumeCombatantAction).toHaveBeenCalledWith(
			expect.objectContaining({ combatantId: 'c1' }),
		);
		expect(effect.delete).toHaveBeenCalled();
		expect(result).toBe('escaped');
	});

	it('keeps the effect on a failure, and still spends the action', async () => {
		const effect = grappled('strength');
		const actor = holder(effect, saveCard(8));

		const result = await escapeModule.escapeEffect(actor as never, 'grab');

		expect(wait, 'one save: no question').not.toHaveBeenCalled();
		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('strength', { dc: 13 });
		expect(consumeCombatantAction).toHaveBeenCalled();
		expect(effect.delete).not.toHaveBeenCalled();
		expect(result).toBe('held');
	});

	it('does nothing when the owner closes the question', async () => {
		wait.mockResolvedValue(null);
		const effect = grappled();
		const actor = holder(effect, saveCard(15));

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBeNull();
		expect(actor.rollSavingThrowToChat).not.toHaveBeenCalled();
		expect(consumeCombatantAction).not.toHaveBeenCalled();
	});
});
