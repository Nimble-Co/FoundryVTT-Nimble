import { SYSTEM_ID } from '#system';
import type { ApplyEffectNode } from '#types/effectTree.js';
import { applyEffectFromCard } from '#utils/chat/applyEffectFromCard.js';

const heldRoll = {
	id: 'held1',
	type: 'heldRoll',
	heldKind: 'advantage',
	value: 1,
	whichRoll: 'attacksOnHolder',
	usedUp: true,
};
const note = { id: 'note1', type: 'note', label: 'Watch', value: 4 };

const goblin = { uuid: 'Actor.goblin', name: 'Goblin', isOwner: true, effects: [] };
const itemEffect = {
	name: 'Condemned',
	toObject: () => ({
		_id: 'fx',
		name: 'Condemned',
		statuses: [],
		system: { lastsUntil: [], rules: [heldRoll, note] },
	}),
};
const item = {
	uuid: 'Actor.hero.Item.spell',
	actor: { uuid: 'Actor.hero', type: 'character', getRollData: () => ({}) },
	effects: { get: (id: string) => (id === 'fx' ? itemEffect : undefined) },
};

function applyNode(fields: Partial<ApplyEffectNode> = {}): ApplyEffectNode {
	return {
		id: 'node1',
		type: 'applyEffect',
		effectId: 'fx',
		recipient: 'targets',
		parentNode: null,
		parentContext: null,
		...fields,
	};
}

const card = {
	flags: { [SYSTEM_ID]: { itemUuid: item.uuid } },
	system: { targets: ['Scene.s.Token.goblin'] },
	update: vi.fn(async () => undefined),
};

describe('applyEffectFromCard with upcast rule raises', () => {
	const createEffect = vi.fn();
	let previousActiveEffect: unknown;

	beforeEach(() => {
		createEffect.mockReset().mockResolvedValue({ uuid: 'Actor.goblin.ActiveEffect.new' });
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) =>
				uuid === item.uuid ? item : uuid === 'Scene.s.Token.goblin' ? { actor: goblin } : null,
			),
		);
		vi.stubGlobal(
			'fromUuid',
			vi.fn(async (uuid: string) => ({ uuid })),
		);
		previousActiveEffect = (CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect;
		(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
			documentClass: { create: createEffect, deleteDocuments: vi.fn() },
		};
	});

	afterEach(() => {
		(CONFIG as unknown as { ActiveEffect: unknown }).ActiveEffect = previousActiveEffect;
		vi.unstubAllGlobals();
	});

	async function appliedRules(node: ApplyEffectNode) {
		await applyEffectFromCard(card, node);
		const [data] = createEffect.mock.calls[0] as [{ system: { rules: unknown[] } }];
		return data.system.rules;
	}

	it('adds the raise to the field of the rule with that id, and leaves the other rules alone', async () => {
		const rules = await appliedRules(
			applyNode({ ruleRaises: [{ ruleId: 'held1', field: 'value', amount: 2 }] }),
		);

		expect(rules).toEqual([{ ...heldRoll, value: 3 }, note]);
	});

	it('leaves a field that is not a number, and a rule that is not there, alone', async () => {
		const rules = await appliedRules(
			applyNode({
				ruleRaises: [
					{ ruleId: 'held1', field: 'heldKind', amount: 2 },
					{ ruleId: 'held1', field: 'missing', amount: 2 },
					{ ruleId: 'gone', field: 'value', amount: 2 },
				],
			}),
		);

		expect(rules).toEqual([heldRoll, note]);
	});

	it('gives the same payload as before for a node with no raises', async () => {
		await applyEffectFromCard(card, applyNode());
		await applyEffectFromCard(card, applyNode({ ruleRaises: [] }));

		const [plain, empty] = createEffect.mock.calls.map(([data]) => data);
		expect(plain).toEqual({
			name: 'Condemned',
			statuses: [],
			system: { lastsUntil: [], rules: [heldRoll, note] },
			origin: item.uuid,
			type: 'nimble',
		});
		expect(empty).toEqual(plain);
	});
});
