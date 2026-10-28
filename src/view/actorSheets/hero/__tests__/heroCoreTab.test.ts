import { describe, expect, it } from 'vitest';
import { blankHero, heroContext } from '../../../../../tests/fixtures/actorSheets/heroFixtures.ts';
import { heroCoreTab } from '../heroCoreTab.ts';

describe('heroCoreTab', () => {
	it('gives each ability its check and its save, with a true minus sign', () => {
		const view = heroCoreTab(blankHero(), heroContext());

		expect(view.abilities.map((a) => a.key)).toEqual([
			'strength',
			'dexterity',
			'intelligence',
			'will',
		]);
		const intelligence = view.abilities[2];
		expect(intelligence.abbreviation).toBe('NIMBLE.abilityScoreAbbreviations.intelligence');
		expect(intelligence.check.mod).toBe('−1');
		expect(intelligence.check.intent).toEqual({
			kind: 'rollAbilityCheck',
			ability: 'intelligence',
		});
		expect(intelligence.save.mod).toBe('−1');
		expect(intelligence.save.intent).toEqual({ kind: 'rollSave', save: 'intelligence' });
	});

	it('marks the roll mode that rules give to a save and to a check', () => {
		const hero = blankHero({
			system: { abilities: { will: { mod: 0, defaultRollMode: 2 } } },
		});
		const view = heroCoreTab(hero, heroContext());

		expect(view.abilities[0].save.rollMode).toBe(1);
		expect(view.abilities[2].save.rollMode).toBe(-1);
		expect(view.abilities[3].check.rollMode).toBe(2);
		expect(view.abilities[1].check.rollMode).toBe(0);
	});

	it('lists the skills A to Z with their ability, roll mode and intent', () => {
		const hero = blankHero({
			system: { skills: { stealth: { mod: 2, defaultRollMode: -1 } } },
		});
		const view = heroCoreTab(hero, heroContext());

		expect(view.skills.map((s) => s.key)).toEqual([
			'arcana',
			'examination',
			'finesse',
			'influence',
			'insight',
			'lore',
			'might',
			'naturecraft',
			'perception',
			'stealth',
		]);
		const stealth = view.skills[9];
		expect(stealth).toMatchObject({
			name: 'NIMBLE.skills.stealth',
			ability: 'dexterity',
			abilityAbbreviation: 'NIMBLE.abilityScoreAbbreviations.dexterity',
			mod: '+2',
			rollMode: -1,
			passive: null,
			intent: { kind: 'rollSkill', skill: 'stealth' },
		});
	});

	it('shows passive skill scores only behind their flag', () => {
		const view = heroCoreTab(blankHero({ flags: { showPassiveSkillScores: true } }), heroContext());

		expect(view.skills.find((s) => s.key === 'might')?.passive).toBe('12');
	});

	it('lists speed, languages, proficiencies and damage defenses, each with its window', () => {
		const view = heroCoreTab(blankHero(), heroContext());

		expect(view.proficiencies.map((p) => [p.label, p.configure])).toEqual([
			['NIMBLE.actorSheet.hero.core.speed', { kind: 'configure', target: 'movement' }],
			['NIMBLE.actorSheet.hero.core.languages', { kind: 'configure', target: 'languages' }],
			['NIMBLE.actorSheet.hero.core.armor', { kind: 'configure', target: 'armorProficiencies' }],
			['NIMBLE.actorSheet.hero.core.weapons', { kind: 'configure', target: 'weaponProficiencies' }],
			['NIMBLE.actorSheet.hero.core.damage', { kind: 'configure', target: 'damageDefenses' }],
		]);
		expect(view.proficiencies[1].value).toBe('Common');
		expect(view.proficiencies[2].value).toBe('NIMBLE.actorSheet.hero.core.none');
		expect(view.proficiencies[3].value).toBe('strength');
		expect(view.proficiencies[4].value).toBe('NIMBLE.actorSheet.hero.core.none');
	});

	it('lists each kind of damage defense that the hero has', () => {
		const hero = blankHero({
			system: {
				attributes: { damageResistances: ['fire', 'cold'], damageImmunities: ['poison'] },
			},
		});
		const damage = heroCoreTab(hero, heroContext()).proficiencies[4];

		expect(damage.value).toBe(
			'NIMBLE.actorSheet.hero.core.defense {"label":"NIMBLE.npcDefenses.resistant","types":"Fire, Cold"}; ' +
				'NIMBLE.actorSheet.hero.core.defense {"label":"NIMBLE.npcDefenses.immune","types":"Poison"}',
		);
	});

	it('shows the speed of each movement type and the note of a speed bonus', () => {
		const hero = blankHero({
			system: { attributes: { movement: { walk: 8, fly: 4, climb: 0, swim: 0, burrow: 0 } } },
			items: [
				{
					id: 'boots',
					name: 'Swift Boots',
					img: '',
					type: 'object',
					system: {},
					rules: [
						{
							id: 'r1',
							type: 'speedBonus',
							active: true,
							amount: 2,
							fields: { movementType: null },
						},
						{
							id: 'r2',
							type: 'speedBonus',
							active: false,
							amount: 9,
							fields: { movementType: 'fly' },
						},
					],
				},
			],
		});
		const speed = heroCoreTab(hero, heroContext()).proficiencies[0];

		expect(speed.value).toBe(
			'NIMBLE.actorSheet.hero.core.speedValue {"type":"NIMBLE.movementTypes.walk","value":"8"}, ' +
				'NIMBLE.actorSheet.hero.core.speedValue {"type":"NIMBLE.movementTypes.fly","value":"4"}',
		);
		expect(speed.note).toBe(
			'NIMBLE.actorSheet.hero.core.speedBonus {"amount":"+2","source":"Swift Boots"}',
		);
	});

	it('adds a Conditions line only for condition immunities', () => {
		const none = heroCoreTab(blankHero(), heroContext());
		expect(none.proficiencies.some((p) => p.label.endsWith('.conditions'))).toBe(false);

		const hero = blankHero({ system: { conditionImmunities: ['prone', 'charmed'] } });
		const view = heroCoreTab(
			hero,
			heroContext({
				labels: {
					...heroContext().labels,
					conditions: { prone: 'Prone', charmed: 'Charmed' },
				},
			}),
		);
		const conditions = view.proficiencies.at(-1);
		expect(conditions?.label).toBe('NIMBLE.actorSheet.hero.core.conditions');
		expect(conditions?.value).toBe('Charmed, Prone');
		expect(conditions?.configure).toBeNull();
	});
});
