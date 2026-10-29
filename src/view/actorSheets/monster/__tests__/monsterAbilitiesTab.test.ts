import { describe, expect, it } from 'vitest';
import {
	goblin,
	minion,
	monsterAbility,
	monsterContext,
	soloMonster,
} from '../../../../../tests/fixtures/actorSheets/monsterFixtures.ts';
import { type MonsterCardView, monsterAbilitiesTab } from '../monsterAbilitiesTab.ts';

const ABILITIES = 'NIMBLE.actorSheet.monster.abilities';

const layout = (view: ReturnType<typeof monsterAbilitiesTab>) =>
	view.groups.map((group) => [
		group.id,
		group.entries.map((entry) => `${entry.kind}:${entry.name}`),
	]);

const cardOf = (view: ReturnType<typeof monsterAbilitiesTab>, id: string) => {
	const entry = view.groups.flatMap((group) => group.entries).find((e) => e.id === id);
	if (entry?.kind !== 'card') throw new Error(`no card ${id}`);
	return entry as MonsterCardView;
};

describe('monsterAbilitiesTab', () => {
	it('groups the abilities as Features, Actions, Bloodied and Last Stand, and leaves out an empty group', () => {
		expect(layout(monsterAbilitiesTab(soloMonster(), monsterContext()))).toEqual([
			['action', ['sequence:Actions', 'card:Move & Smack', 'card:Grab & Throw']],
			['bloodied', ['card:Bloodied']],
			['lastStand', ['card:Last Stand']],
		]);
		expect(layout(monsterAbilitiesTab(goblin(), monsterContext()))).toEqual([
			['feature', ['card:Haha, Missed Me!']],
			['action', ['card:Stab', 'card:Shoot']],
		]);
	});

	it('gives the Bloodied and Last Stand groups their tone', () => {
		const groups = monsterAbilitiesTab(soloMonster(), monsterContext()).groups;

		expect(groups.map((group) => [group.label, group.tone])).toEqual([
			[`${ABILITIES}.groups.action`, undefined],
			[`${ABILITIES}.groups.bloodied`, 'bloodied'],
			[`${ABILITIES}.groups.lastStand`, 'lastStand'],
		]);
	});

	it('keeps the hand-sorted order: loose actions first, then each sequence with its actions', () => {
		const monster = soloMonster();
		monster.items.push(
			monsterAbility(monster.id, 'kick', 'Kick', 'action', 50000, { description: '<p>1d4.</p>' }),
			monsterAbility(monster.id, 'roar', 'Roar', 'action', 900000, {
				description: '<p>Loud.</p>',
				parentItemId: 'gone',
			}),
		);
		const moveAndSmack = monster.items.find((item) => item.id === 'moveAndSmack0001')!;
		moveAndSmack.sort = 400000;

		const actions = monsterAbilitiesTab(monster, monsterContext()).groups[0];

		expect(actions.entries.map((entry) => [entry.name, entry.reorder.parentId])).toEqual([
			['Kick', null],
			['Roar', null],
			['Actions', null],
			['Grab & Throw', 'sequence00000001'],
			['Move & Smack', 'sequence00000001'],
		]);
	});

	it('nests the actions of a sequence, and gives the sequence its text', () => {
		const view = monsterAbilitiesTab(
			soloMonster(),
			monsterContext({ enrichedDescriptions: { sequence00000001: '<p>enriched</p>' } }),
		);
		const [sequence] = view.groups[0].entries;

		expect(sequence).toMatchObject({
			kind: 'sequence',
			text: 'After each hero’s turn, choose one:',
			html: '<p>enriched</p>',
			reorder: { sequence: true, group: 'action' },
		});
		expect(cardOf(view, 'moveAndSmack0001').nested).toBe(true);
	});

	it('rolls an ability with activation effects and posts one without', () => {
		const view = monsterAbilitiesTab(goblin(), monsterContext());

		expect(cardOf(view, 'stab000000000001')).toMatchObject({
			roll: true,
			use: {
				label: 'NIMBLE.actorSheet.parts.abilityCard.roll {"name":"Stab"}',
				intent: { kind: 'activate', itemId: 'stab000000000001' },
			},
		});
		expect(cardOf(view, 'hahaMissedMe0001')).toMatchObject({
			roll: false,
			use: { intent: { kind: 'activate', itemId: 'hahaMissedMe0001' } },
		});
	});

	it('shows the range or the reach, and the plain text until the enriched text comes', () => {
		const shoot = cardOf(monsterAbilitiesTab(goblin(), monsterContext()), 'shoot00000000001');

		expect(shoot.range).toBe('NIMBLE.actorSheet.shared.range {"distance":"8"}');
		expect(shoot.description).toBe('1d6+2.');
		expect(shoot.descriptionHtml).toBeUndefined();
		expect(cardOf(monsterAbilitiesTab(goblin(), monsterContext()), 'stab000000000001').range).toBe(
			undefined,
		);
	});

	it('shows the uses of the charge pool of the ability, and nothing with no pool', () => {
		const context = monsterContext({
			itemPools: { shoot00000000001: [{ current: 1, max: 1, per: 'encounter' }] },
		});

		expect(cardOf(monsterAbilitiesTab(goblin(), context), 'shoot00000000001').uses).toEqual({
			left: 1,
			max: 1,
			per: 'NIMBLE.actorSheet.shared.per.encounter',
		});
		expect(cardOf(monsterAbilitiesTab(goblin(), context), 'stab000000000001').uses).toBeUndefined();
	});

	it('shows an item with no description and no effects as a heading line', () => {
		const monster = goblin();
		monster.items.push(monsterAbility(monster.id, 'tactics', 'Tactics', 'feature', 50000));

		const features = monsterAbilitiesTab(monster, monsterContext()).groups[0];

		expect(features.entries[0]).toMatchObject({ kind: 'heading', name: 'Tactics' });
	});

	it('opens the item window from the pen, and drags the item only when the user may change the monster', () => {
		const stab = cardOf(monsterAbilitiesTab(minion(), monsterContext()), 'koboldStab000001');

		expect(stab.edit.intent).toEqual({ kind: 'openItem', itemId: 'koboldStab000001' });
		expect(stab.drag).toEqual({
			kind: 'item',
			uuid: 'Actor.koboldMinion0001.Item.koboldStab000001',
		});
		expect(
			cardOf(monsterAbilitiesTab(minion(), monsterContext({ editable: false })), 'koboldStab000001')
				.drag,
		).toBeNull();
	});

	it('lists the cards with text for Expand all, and says so when there are no abilities', () => {
		const view = monsterAbilitiesTab(soloMonster(), monsterContext());

		expect(view.cardIds).toEqual([
			'moveAndSmack0001',
			'grabAndThrow0001',
			'bloodied00000001',
			'lastStand0000001',
		]);
		const none = monsterAbilitiesTab(goblin({ items: [] }), monsterContext());
		expect(none.groups).toEqual([]);
		expect(none.empty).toBe(`${ABILITIES}.empty`);
	});
});
