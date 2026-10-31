import { describe, expect, it } from 'vitest';
import {
	blankHero,
	conditionLike,
	effectsContext,
	effectsHero,
	heroContext,
} from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { effectsOnHero, heroEffectsTab } from '../heroEffectsTab.ts';

const FX = 'NIMBLE.actorSheet.shared.effects';

const layout = (view: ReturnType<typeof heroEffectsTab>) =>
	view.groups.map((group) => [group.label, group.note, group.rows.map((row) => row.name)]);

const rowOf = (view: ReturnType<typeof heroEffectsTab>, id: string) => {
	const row = view.groups.flatMap((group) => group.rows).find((entry) => entry.id === id);
	if (!row) throw new Error(`no row ${id}`);
	return row;
};

describe('heroEffectsTab', () => {
	it('lists the active effects, the conditions on the hero and the passive effects, A to Z, with counts', () => {
		const view = heroEffectsTab(effectsHero(), effectsContext());

		expect(layout(view)).toEqual([
			[`${FX}.active`, '2', ['Bless', 'Rage']],
			['NIMBLE.actorSheet.hero.effects.conditionsOn', '1', ['Dazed']],
			[`${FX}.passive`, '2', ['Armor', 'Old Blessing']],
		]);
	});

	it('leaves out an empty group, and has one line when every group is empty', () => {
		const view = heroEffectsTab(blankHero(), heroContext());

		expect(layout(view)).toEqual([]);
		expect(view.empty).toBe(`${FX}.noEffects`);
		expect(heroEffectsTab(effectsHero(), effectsContext()).empty).toBeNull();
	});

	it('counts the active effects and the conditions, not the passive effects', () => {
		expect(effectsOnHero(effectsHero(), effectsContext())).toBe(3);
		expect(effectsOnHero(blankHero(), heroContext())).toBe(0);
	});

	describe('Inspiration', () => {
		const IN = 'NIMBLE.actorSheet.hero.effects.inspiration';
		const inspired = () => {
			const hero = effectsHero();
			hero.system.resources.inspiration = true;
			return hero;
		};

		it('is an active effect, A to Z with the others, and counts on the tab', () => {
			const view = heroEffectsTab(inspired(), effectsContext());

			expect(layout(view)[0]).toEqual([`${FX}.active`, '3', ['Bless', `${IN}.name`, 'Rage']]);
			expect(effectsOnHero(inspired(), effectsContext())).toBe(4);
		});

		it('shows under Active effects when it is the only effect', () => {
			const hero = blankHero();
			hero.system.resources.inspiration = true;
			const view = heroEffectsTab(hero, heroContext());

			expect(layout(view)).toEqual([[`${FX}.active`, '1', [`${IN}.name`]]]);
			expect(view.empty).toBeNull();
		});

		it('ends from its row with no question, and lasts until a Safe Rest', () => {
			const row = rowOf(heroEffectsTab(inspired(), effectsContext()), 'inspiration');

			expect(row).toMatchObject({
				icon: 'fa-solid fa-star',
				description: `${IN}.description`,
				cost: { text: `${IN}.lasts` },
				facts: [[`${FX}.facts.lasts`, `${IN}.lasts`]],
				use: {
					kind: 'act',
					label: 'NIMBLE.actorSheet.shared.endName {"name":"' + `${IN}.name` + '"}',
					intent: { kind: 'setInspiration', value: false },
				},
				edit: null,
			});
			expect(row.summary, 'the first sentence of the description').toBe(`${IN}.description`);
		});

		it('is not on the tab when the hero has none', () => {
			const view = heroEffectsTab(effectsHero(), effectsContext());

			expect(view.groups.flatMap((group) => group.rows).map((row) => row.id)).not.toContain(
				'inspiration',
			);
		});
	});

	it('ends a toggle effect from its row, with no question, and says when it ends', () => {
		const row = rowOf(heroEffectsTab(effectsHero(), effectsContext()), 'effect-rageEffect');

		expect(row.use).toEqual({
			kind: 'act',
			label: 'NIMBLE.actorSheet.shared.endName {"name":"Rage"}',
			intent: { kind: 'endEffect', effectId: 'rageEffect' },
		});
		expect(row.state).toBe('active');
		expect(row.cost.text).toBe(`${FX}.inactiveRound`);
	});

	it('takes the duration of a toggle effect from the activation when the rule has no end', () => {
		const hero = effectsHero();
		const rage = hero.items.find((item) => item.id === 'rage')!;
		rage.rules = [{ ...rage.rules[0], fields: { type: 'toggleEffect' } }];
		rage.system = {
			...rage.system,
			activation: {
				...(rage.system.activation as object),
				duration: { type: 'minute', quantity: 10, details: '' },
			},
		};

		const row = rowOf(heroEffectsTab(hero, effectsContext()), 'effect-rageEffect');

		expect(row.cost.text).toBe('10 NIMBLE.durationsPlural.minute');
	});

	it('asks before it removes a timed effect', () => {
		const row = rowOf(heroEffectsTab(effectsHero(), effectsContext()), 'effect-bless');

		expect(row.use).toEqual({
			kind: 'ask',
			ask: {
				label: `${FX}.removeName {"name":"Bless"}`,
				question: `${FX}.removeQuestion {"name":"Bless"}`,
				confirmLabel: `${FX}.remove`,
				intent: { kind: 'removeEffect', effectId: 'bless', itemId: null },
			},
		});
		expect(row.cost.text).toBe('3 rounds');
		expect(row.description).toBe('Add 1d4.');
	});

	it('asks before it removes a condition, and names where it comes from', () => {
		const row = rowOf(heroEffectsTab(effectsHero(), effectsContext()), 'condition-dazed');

		expect(row.use).toMatchObject({
			kind: 'ask',
			ask: { intent: { kind: 'setCondition', conditionId: 'dazed', active: false } },
		});
		expect(row.description).toBe('You lose 1 action.');
		expect(row.summary, 'no source: the first sentence').toBe('You lose 1 action.');
	});

	it('removes a passive effect of the hero after a question, and names the item of an item effect', () => {
		const view = heroEffectsTab(effectsHero(), effectsContext());

		expect(rowOf(view, 'effect-blessing').use).toMatchObject({
			kind: 'ask',
			ask: { intent: { kind: 'removeEffect', effectId: 'blessing', itemId: null } },
		});
		const armor = rowOf(view, 'effect-armorEffect');
		expect(armor.use).toBeNull();
		expect(armor.summary).toBe(`${FX}.fromItem {"name":"Leather Armor"}`);
		expect(armor.edit).toEqual({ kind: 'openItem', itemId: 'leather' });
	});

	it('gives each condition of the system a toggle that any owner can use', () => {
		const view = heroEffectsTab(effectsHero(), effectsContext());

		expect(view.conditions).toEqual({
			label: `${FX}.allConditions`,
			options: [
				{
					id: 'dazed',
					name: 'Dazed',
					img: 'icons/conditions/dazed.svg',
					on: true,
					intent: { kind: 'setCondition', conditionId: 'dazed', active: false },
				},
				{
					id: 'prone',
					name: 'Prone',
					img: 'icons/conditions/prone.svg',
					on: false,
					intent: { kind: 'setCondition', conditionId: 'prone', active: true },
				},
			],
			other: { label: `${FX}.otherConditions`, options: [] },
		});
	});

	it('leaves out the states that the system sets, and gives the other conditions their own set', () => {
		const condition = (id: string) => conditionLike({ id, name: id });
		const view = heroEffectsTab(
			effectsHero(),
			effectsContext({
				conditions: ['bloodied', 'charged', 'concentration', 'dazed', 'dead', 'dying']
					.map(condition)
					.concat(['lastStand', 'marked', 'wounded'].map(condition)),
			}),
		);

		expect(view.conditions.options.map((option) => option.id)).toEqual(['dazed']);
		expect(view.conditions.other.options.map((option) => option.id)).toEqual(['charged', 'marked']);
	});
});
