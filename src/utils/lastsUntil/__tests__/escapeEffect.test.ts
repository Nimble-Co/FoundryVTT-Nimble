import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const consumeCombatantAction = vi.fn();
const addCardEvents = vi.fn(async () => true);
let escapeModule: typeof import('../escapeEffect.js');

beforeAll(async () => {
	vi.resetModules();
	const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
		'#utils/chat/cardEvents.js',
	);
	vi.doMock('#utils/combat/combatTurnActions.js', () => ({ consumeCombatantAction }));
	vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents }));
	escapeModule = await import('../escapeEffect.js');
});

function saveCard(total: number, natural = 10, dc: number | null = 13) {
	return {
		id: 's1',
		type: 'savingThrow',
		system: { dc, rollType: 'save', saveKey: 'strength' },
		rolls: [{ total, terms: [{ faces: 20, results: [{ result: natural, active: true }] }] }],
	};
}

function grappled(
	saves: string[] = ['strength', 'dexterity'],
	dc = '13',
	more: { noDc?: boolean; skills?: string[] } = {},
) {
	return {
		id: 'grab',
		name: 'Grappled',
		origin: null as string | null,
		system: { escape: { dc, saves, ...more } },
		delete: vi.fn(async () => undefined),
	};
}

function holder(effect: ReturnType<typeof grappled>, card: unknown) {
	return {
		uuid: 'Actor.hero',
		name: 'Tessa',
		type: 'character',
		getRollData: () => ({ strength: 3 }),
		effects: { get: (id: string) => (id === effect.id ? effect : undefined) },
		rollSavingThrowToChat: vi.fn(async (..._args: unknown[]) => card),
		rollSkillCheckToChat: vi.fn(async (..._args: unknown[]) => card) as
			| ReturnType<typeof vi.fn>
			| undefined,
	};
}

const wait = vi.fn();

beforeEach(() => {
	consumeCombatantAction.mockReset();
	addCardEvents.mockClear();
	wait.mockReset().mockResolvedValue('save:dexterity');
	(foundry.applications as unknown as { api: object }).api = {
		...(foundry.applications as unknown as { api: object }).api,
		DialogV2: { wait },
	};
	const combatant = { id: 'c1', actor: { uuid: 'Actor.hero' } };
	(game as unknown as { combat: unknown }).combat = { started: true, combatants: [combatant] };
});

afterEach(() => {
	(game as unknown as { combat: unknown }).combat = null;
	vi.unstubAllGlobals();
});

describe('escapeRollsOf, hasEscape and escapeDcOf', () => {
	const save = (key: string) => ({ kind: 'save', key });
	const skill = (key: string) => ({ kind: 'skill', key });

	it('reads the allowed saves, then the allowed skills, in their order', () => {
		const rollsOf = escapeModule.escapeRollsOf;
		expect(rollsOf({ saves: ['will', 'strength'] }, true)).toEqual([
			save('strength'),
			save('will'),
		]);
		expect(rollsOf({ saves: ['dexterity'], skills: ['stealth', 'finesse'] }, true)).toEqual([
			save('dexterity'),
			skill('finesse'),
			skill('stealth'),
		]);
		expect(rollsOf({ saves: [], skills: ['finesse'] }, true)).toEqual([skill('finesse')]);
	});

	it('gives a creature with no skills the save of each skill stat, once', () => {
		expect(
			escapeModule.escapeRollsOf({ saves: ['dexterity'], skills: ['finesse', 'might'] }, false),
		).toEqual([save('strength'), save('dexterity')]);
	});

	it('falls back to STR and DEX when nothing is on', () => {
		const fallback = [save('strength'), save('dexterity')];
		expect(escapeModule.escapeRollsOf({ saves: [], skills: [] }, true)).toEqual(fallback);
		expect(escapeModule.escapeRollsOf(undefined, true)).toEqual(fallback);
	});

	it('has an Escape with a DC, or with No DC on', () => {
		expect(escapeModule.hasEscape({ escape: { dc: '13' } })).toBe(true);
		expect(escapeModule.hasEscape({ escape: { dc: '', noDc: true } })).toBe(true);
		expect(escapeModule.hasEscape({ escape: { dc: ' ', noDc: false } })).toBe(false);
		expect(escapeModule.hasEscape({})).toBe(false);
		expect(escapeModule.hasEscape(undefined)).toBe(false);
	});

	it('reads a DC that is a number', () => {
		expect(escapeModule.escapeDcOf(' 13 ')).toBe(13);
		expect(escapeModule.escapeDcOf('10 + @key')).toBeNull();
		expect(escapeModule.escapeDcOf('')).toBeNull();
	});
});

const linkOf = (effectName = 'Grappled') => ({
	escapeRoll: {
		holderUuid: 'Actor.hero',
		holderName: 'Tessa',
		effectId: 'grab',
		effectName,
		noDc: false,
	},
});

describe('escapeEffect', () => {
	it('rolls the picked save with the link and the hint, and spends 1 action', async () => {
		const effect = grappled();
		const actor = holder(effect, saveCard(15));

		const result = await escapeModule.escapeEffect(actor as never, 'grab');

		expect(wait).toHaveBeenCalledWith(
			expect.objectContaining({
				buttons: [
					{ action: 'save:strength', label: 'STR save' },
					{ action: 'save:dexterity', label: 'DEX save' },
				],
			}),
		);
		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('dexterity', {
			dc: 13,
			checkHint: 'Escape Grappled (DC 13)',
			cardFlags: linkOf(),
		});
		expect(consumeCombatantAction).toHaveBeenCalledWith(
			expect.objectContaining({ combatantId: 'c1' }),
		);
		expect(result).toBe('rolled');
	});

	it('leaves the end to the active GM, also on a success', async () => {
		const effect = grappled(['strength']);
		const actor = holder(effect, saveCard(20, 20));

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBe('rolled');
		expect(wait, 'one save: no question').not.toHaveBeenCalled();
		expect(effect.delete).not.toHaveBeenCalled();
	});

	it('spends no action out of combat', async () => {
		(game as unknown as { combat: unknown }).combat = { started: false, combatants: [] };
		const actor = holder(grappled(['strength']), saveCard(8));

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBe('rolled');
		expect(consumeCombatantAction).not.toHaveBeenCalled();
	});

	it('spends no action when the roll window is closed', async () => {
		const actor = holder(grappled(['strength']), null);

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBeNull();
		expect(consumeCombatantAction).not.toHaveBeenCalled();
	});

	it('works out a DC formula from the creature that applied the effect', async () => {
		vi.stubGlobal('Roll', {
			replaceFormulaData: (formula: string, data: Record<string, number>) =>
				formula.replace(/@(\w+)/g, (_match, key: string) => String(data[key] ?? 0)),
			safeEval: (formula: string) => Function(`return ${formula}`)(),
		});
		const bear = { documentName: 'Actor', type: 'npc', getRollData: () => ({ strength: 5 }) };
		vi.stubGlobal('fromUuidSync', () => bear);
		const effect = grappled(['strength'], '10 + @strength');
		effect.origin = 'Actor.bear';
		const actor = holder(effect, saveCard(16));

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBe('rolled');
		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith(
			'strength',
			expect.objectContaining({ dc: 15 }),
		);
	});

	it('a DC that is not a number rolls with no DC and the hint with no DC', async () => {
		vi.stubGlobal('fromUuidSync', () => null);
		const actor = holder(grappled(['strength'], '@missing'), saveCard(16));

		await escapeModule.escapeEffect(actor as never, 'grab');

		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('strength', {
			checkHint: 'Escape Grappled',
			cardFlags: { escapeRoll: { ...linkOf().escapeRoll, noDc: true } },
		});
	});

	it('cannot escape an effect that is not on the actor itself', async () => {
		const actor = holder(grappled(), saveCard(15));

		expect(await escapeModule.escapeEffect(actor as never, 'on-an-item')).toBeNull();
		expect(actor.rollSavingThrowToChat).not.toHaveBeenCalled();
	});

	it('does nothing when the owner closes the question', async () => {
		wait.mockResolvedValue(null);
		const effect = grappled();
		const actor = holder(effect, saveCard(15));

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBeNull();
		expect(actor.rollSavingThrowToChat).not.toHaveBeenCalled();
		expect(consumeCombatantAction).not.toHaveBeenCalled();
	});

	it('rolls a skill check with the DC, the link and the hint', async () => {
		const effect = grappled([], '12', { skills: ['finesse'] });
		const actor = holder(effect, { ...saveCard(14), type: 'skillCheck' });

		expect(await escapeModule.escapeEffect(actor as never, 'grab')).toBe('rolled');
		expect(wait, 'one roll: no question').not.toHaveBeenCalled();
		expect(actor.rollSkillCheckToChat).toHaveBeenCalledWith('finesse', {
			dc: 12,
			checkHint: 'Escape Grappled (DC 12)',
			cardFlags: linkOf(),
		});
		expect(consumeCombatantAction).toHaveBeenCalled();
	});

	it('offers the saves and the checks, and rolls the picked check', async () => {
		wait.mockResolvedValue('skill:finesse');
		const effect = grappled(['strength'], '12', { skills: ['finesse'] });
		const actor = holder(effect, saveCard(14));

		await escapeModule.escapeEffect(actor as never, 'grab');

		expect(wait).toHaveBeenCalledWith(
			expect.objectContaining({
				content: '<p>Which roll do you make?</p>',
				buttons: [
					{ action: 'save:strength', label: 'STR save' },
					{ action: 'skill:finesse', label: 'Finesse check' },
				],
			}),
		);
		expect(actor.rollSkillCheckToChat).toHaveBeenCalledWith('finesse', expect.anything());
		expect(actor.rollSavingThrowToChat).not.toHaveBeenCalled();
	});

	it('a creature with no skills rolls the save of the skill stat', async () => {
		const effect = grappled([], '12', { skills: ['finesse'] });
		const actor = holder(effect, saveCard(14));
		actor.rollSkillCheckToChat = undefined;

		await escapeModule.escapeEffect(actor as never, 'grab');

		expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('dexterity', expect.anything());
	});

	describe('with No DC', () => {
		it('rolls with no DC and adds the waiting line when the roll settles nothing', async () => {
			const effect = grappled(['strength'], '', { noDc: true });
			const card = saveCard(14, 10, null);
			const actor = holder(effect, card);

			await escapeModule.escapeEffect(actor as never, 'grab');

			expect(actor.rollSavingThrowToChat).toHaveBeenCalledWith('strength', {
				checkHint: 'Escape Grappled',
				cardFlags: { escapeRoll: { ...linkOf().escapeRoll, noDc: true } },
			});
			expect(addCardEvents).toHaveBeenCalledWith(card, [
				expect.objectContaining({
					kind: 'escape',
					action: expect.objectContaining({ kind: 'escapeRuling', state: 'waiting' }),
				}),
			]);
		});

		it('adds no line on a natural 20 or a natural 1, which settle the roll', async () => {
			for (const natural of [20, 1]) {
				const actor = holder(
					grappled(['strength'], '', { noDc: true }),
					saveCard(14, natural, null),
				);
				await escapeModule.escapeEffect(actor as never, 'grab');
			}

			expect(addCardEvents).not.toHaveBeenCalled();
		});

		it('adds no line to an Escape with a DC', async () => {
			const actor = holder(grappled(['strength']), saveCard(8));

			await escapeModule.escapeEffect(actor as never, 'grab');

			expect(addCardEvents).not.toHaveBeenCalled();
		});
	});
});
