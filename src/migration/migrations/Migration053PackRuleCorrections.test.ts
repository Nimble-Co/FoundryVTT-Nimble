import { describe, expect, it } from 'vitest';
import savageAwareness from '../../../packs/classFeatures/core/berserker/berserker-subclasses/path-of-the-red-mist/savage-awareness.json';
import auraOfRefuge from '../../../packs/classFeatures/core/oathsworn/oathsworn-subclasses/oath-of-refuge/aura-of-refuge.json';
import envelopedByTheMaster from '../../../packs/classFeatures/core/shadowmancer/shadowmancer-subclasses/pact-of-the-red-dragon/enveloped-by-the-master.json';
import fleetFooted from '../../../packs/classFeatures/core/stormshifter/chimeric-boon/fleet-footed.json';
import winged from '../../../packs/classFeatures/core/stormshifter/chimeric-boon/winged.json';
import { Migration053PackRuleCorrections } from './Migration053PackRuleCorrections.js';

type Rule = Record<string, any>;

const SOURCE_PREFIX = 'Compendium.nimble.nimble-class-features.Item.';

const OLD_SAVAGE_AWARENESS_RULE: Rule = {
	type: 'skillRollMode',
	disabled: false,
	id: 'savage-awareness-perception',
	identifier: '',
	label: 'Savage Awareness (Perception, blood only)',
	predicate: {},
	priority: 1,
	value: 1,
	skills: ['perception'],
	mode: 'adjust',
};

const OLD_SAVAGE_AWARENESS_DESCRIPTION =
	'<p>Advantage on Perception checks to notice or track down blood. Blindsight 2 while Raging: you ignore the Blinded condition and can see through darkness and Invisibility within that Range.</p><p><em>The Perception advantage is pre-set on the roll dialog for blood-related checks; dial it back for other Perception checks. Blindsight is not automated.</em></p>';

const OLD_AURA_ARMOR_RULE: Rule = {
	type: 'armorClass',
	disabled: false,
	id: '8UnnMpfPiHgPnPla',
	identifier: '',
	label: '',
	predicate: { self: 'shield' },
	priority: 1,
	formula: '@willpower',
	mode: 'add',
};

const AURA_REDIRECT_RULE: Rule = {
	type: 'modifyIncomingAttack',
	disabled: false,
	id: 'ePC8z2QmXucSUUbm',
	identifier: '',
	label: '',
	predicate: {},
	priority: 1,
	modifier: 'redirectToSelf',
	range: 4,
};

const OLD_MAX_WOUNDS_RULE: Rule = {
	type: 'maxWounds',
	disabled: false,
	id: 'NRuKjNvofPWzKu5v',
	identifier: '',
	label: 'Enveloped by the Master',
	predicate: {},
	priority: 1,
	value: '1d4',
};

const OLD_FLEET_FOOTED_RULE: Rule = {
	type: 'speedBonus',
	value: '2',
	label: 'Fleet Footed',
	id: 'EcMJKDIwbT3q5cP3',
};

const OLD_WINGED_RULE: Rule = {
	type: 'speedBonus',
	value: '@attributes.movement.walk',
	movementType: 'fly',
	label: 'Winged',
	id: 'RivdlU4xcZIxnZQt',
};

function embeddedCopy(pack: { _id: string; name: string }, system: Record<string, any>) {
	return {
		type: 'feature',
		name: pack.name,
		_stats: { compendiumSource: `${SOURCE_PREFIX}${pack._id}` },
		system: { rules: [], ...system } as Record<string, any>,
	};
}

function savageAwarenessCopy(overrides: Record<string, any> = {}) {
	return embeddedCopy(savageAwareness, {
		class: 'berserker',
		rules: [structuredClone(OLD_SAVAGE_AWARENESS_RULE)],
		description: OLD_SAVAGE_AWARENESS_DESCRIPTION,
		...overrides,
	});
}

function auraOfRefugeCopy(overrides: Record<string, any> = {}) {
	return embeddedCopy(auraOfRefuge, {
		class: 'oathsworn',
		rules: [structuredClone(OLD_AURA_ARMOR_RULE), structuredClone(AURA_REDIRECT_RULE)],
		...overrides,
	});
}

const migration = new Migration053PackRuleCorrections();

describe('Migration053PackRuleCorrections', () => {
	it('runs at schema version 53', () => {
		expect(Migration053PackRuleCorrections.version).toBe(53);
		expect(migration.version).toBe(53);
	});
});

describe('Savage Awareness', () => {
	it('replaces the blanket Perception rule with the rule the pack now ships', async () => {
		const source = savageAwarenessCopy();

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(savageAwareness.system.rules);
	});

	it('drops the automation note from the description', async () => {
		const source = savageAwarenessCopy();

		await migration.updateItem(source);

		expect(source.system.description).toBe(savageAwareness.system.description);
	});

	it('keeps a rule the GM added beside the shipped one', async () => {
		const authored = {
			type: 'situationalRollMode',
			id: 'homebrewRuleId01',
			label: 'While Raging',
			checkType: 'skillCheck',
			skills: ['perception'],
			value: 1,
		};
		const source = savageAwarenessCopy({
			rules: [structuredClone(OLD_SAVAGE_AWARENESS_RULE), authored],
		});

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([...savageAwareness.system.rules, authored]);
	});

	it('leaves a rule the GM retuned alone', async () => {
		const edited = { ...structuredClone(OLD_SAVAGE_AWARENESS_RULE), value: 2 };
		const source = savageAwarenessCopy({ rules: [edited] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([edited]);
	});

	it('leaves a description the GM rewrote alone', async () => {
		const source = savageAwarenessCopy({ description: '<p>Our table reads this differently.</p>' });

		await migration.updateItem(source);

		expect(source.system.description).toBe('<p>Our table reads this differently.</p>');
	});

	it('changes nothing on a second run', async () => {
		const source = savageAwarenessCopy();

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('Aura of Refuge', () => {
	it('rewrites the armour formula onto the real ability key', async () => {
		const source = auraOfRefugeCopy();

		await migration.updateItem(source);

		expect(source.system.rules[0]).toEqual(auraOfRefuge.system.rules[0]);
		expect(source.system.rules[0].formula).toBe('@will');
	});

	it('leaves every other rule on the feature untouched', async () => {
		const source = auraOfRefugeCopy();

		await migration.updateItem(source);

		expect(source.system.rules[1]).toEqual(AURA_REDIRECT_RULE);
	});

	it('leaves a formula the GM edited alone', async () => {
		const edited = { ...structuredClone(OLD_AURA_ARMOR_RULE), formula: '@will + 1' };
		const source = auraOfRefugeCopy({ rules: [edited] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([edited]);
	});

	it('changes nothing on a second run', async () => {
		const source = auraOfRefugeCopy();

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('rules the pack no longer ships', () => {
	it.each([
		['Enveloped by the Master', envelopedByTheMaster, OLD_MAX_WOUNDS_RULE, 'shadowmancer'],
		['Fleet Footed', fleetFooted, OLD_FLEET_FOOTED_RULE, 'stormshifter'],
		['Winged', winged, OLD_WINGED_RULE, 'stormshifter'],
	])('removes the %s rule', async (_name, pack, rule, featureClass) => {
		const source = embeddedCopy(pack, { class: featureClass, rules: [structuredClone(rule)] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
		expect(pack.system.rules).toEqual([]);
	});

	it.each([
		['Enveloped by the Master', envelopedByTheMaster, OLD_MAX_WOUNDS_RULE, 'shadowmancer'],
		['Fleet Footed', fleetFooted, OLD_FLEET_FOOTED_RULE, 'stormshifter'],
		['Winged', winged, OLD_WINGED_RULE, 'stormshifter'],
	])('leaves an edited %s rule alone', async (_name, pack, rule, featureClass) => {
		const edited = { ...structuredClone(rule), value: '5' };
		const source = embeddedCopy(pack, { class: featureClass, rules: [edited] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([edited]);
	});

	it('removes a stored rule carrying the defaults the data model filled in', async () => {
		const stored = {
			...structuredClone(OLD_FLEET_FOOTED_RULE),
			disabled: false,
			identifier: '',
			predicate: {},
			priority: 1,
		};
		const source = embeddedCopy(fleetFooted, { class: 'stormshifter', rules: [stored] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
	});

	it.each([
		['gated with a predicate', { predicate: { self: 'bloodied' } }],
		['switched off', { disabled: true }],
		['gave an identifier', { identifier: 'houserule-speed' }],
		['reprioritised', { priority: 5 }],
		['set to never show a card', { suppressActivationCard: 'never' }],
	])('leaves a Fleet Footed rule the GM %s alone', async (_how, edit) => {
		const edited = { ...structuredClone(OLD_FLEET_FOOTED_RULE), ...edit };
		const source = embeddedCopy(fleetFooted, { class: 'stormshifter', rules: [edited] });

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([edited]);
	});

	it('keeps a rule the GM added beside the dropped one', async () => {
		const authored = { type: 'speedBonus', value: '1', label: 'Table houserule', id: 'ownRuleId1' };
		const source = embeddedCopy(fleetFooted, {
			class: 'stormshifter',
			rules: [structuredClone(OLD_FLEET_FOOTED_RULE), authored],
		});

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored]);
	});

	it('changes nothing on a second run', async () => {
		const source = embeddedCopy(winged, {
			class: 'stormshifter',
			rules: [structuredClone(OLD_WINGED_RULE)],
		});

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});
});

describe('matching', () => {
	it('matches a copy without a compendium source id by class and name', async () => {
		const source = {
			type: 'feature',
			name: 'Fleet Footed',
			system: { class: 'stormshifter', rules: [structuredClone(OLD_FLEET_FOOTED_RULE)] },
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
	});

	it('leaves a same-named feature from another class alone', async () => {
		const source = {
			type: 'feature',
			name: 'Fleet Footed',
			system: { class: 'hunter', rules: [structuredClone(OLD_FLEET_FOOTED_RULE)] },
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([OLD_FLEET_FOOTED_RULE]);
	});

	it('leaves a feature from another compendium alone', async () => {
		const source = {
			type: 'feature',
			name: 'Fleet Footed',
			_stats: { compendiumSource: 'Compendium.homebrew.features.Item.someOtherId00' },
			system: { class: 'stormshifter', rules: [structuredClone(OLD_FLEET_FOOTED_RULE)] },
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([OLD_FLEET_FOOTED_RULE]);
	});

	it('leaves an item that is not a feature alone', async () => {
		const source = {
			type: 'object',
			name: 'Fleet Footed',
			system: { class: 'stormshifter', rules: [structuredClone(OLD_FLEET_FOOTED_RULE)] },
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([OLD_FLEET_FOOTED_RULE]);
	});
});
