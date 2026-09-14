import { beforeEach, describe, expect, it, vi } from 'vitest';
import spellShaper from '../../../packs/classFeatures/core/mage/mage-progression/spell-shaper.json';
import talentedResearcher from '../../../packs/classFeatures/core/mage/mage-progression/talented-researcher.json';
import sacredGraces from '../../../packs/classFeatures/core/shepherd/shepherd-progression/sacred-graces.json';
import searingLight from '../../../packs/classFeatures/core/shepherd/shepherd-progression/searing-light.json';
import lifebindingSpirit from '../../../packs/spells/core/radiant/lifebinding-spirit.json';
import { Migration053MageShepherdPilot } from './Migration053MageShepherdPilot.js';

const OLD_COST_DETAILS = 'A diamond  worth at least 10,000 gp';

const migration = new Migration053MageShepherdPilot();
const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

beforeEach(() => log.mockClear());

/** The state the pack shipped before the pilot: no rules on the item. */
function withoutRules(packItem: object): any {
	const source = structuredClone(packItem) as any;
	source.system.rules = [];
	return source;
}

/** The state the pack shipped before the pilot: an empty description. */
function withoutDescription(packItem: object): any {
	const source = structuredClone(packItem) as any;
	source.system.description = '';
	return source;
}

function withOldCostDetails(packItem: object): any {
	const source = structuredClone(packItem) as any;
	source.system.activation.cost.details = OLD_COST_DETAILS;
	return source;
}

function gmRule(overrides: Record<string, unknown>): Record<string, unknown> {
	return { type: 'note', disabled: false, id: 'GMauthoredRule001', predicate: {}, ...overrides };
}

describe('Migration053MageShepherdPilot: Talented Researcher', () => {
	it('adds the study bonus the pack ships', async () => {
		const source = withoutRules(talentedResearcher);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(talentedResearcher.system.rules);
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves a copy that already carries the packaged rule alone', async () => {
		const source = structuredClone(talentedResearcher) as any;

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(talentedResearcher.system.rules);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a GM rule that already offers the same two skill checks', async () => {
		const authored = gmRule({
			type: 'situationalRollMode',
			checkType: 'skillCheck',
			skills: ['arcana', 'lore'],
			value: 1,
			label: 'Book learning',
		});
		const source = withoutRules(talentedResearcher);
		source.system.rules.push(authored);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored]);
	});

	it('adds the bonus beside an unrelated GM rule and keeps it', async () => {
		const authored = gmRule({ label: 'GM note' });
		const source = withoutRules(talentedResearcher);
		source.system.rules.push(authored);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored, ...talentedResearcher.system.rules]);
	});

	it('adds the bonus beside a narrower GM rule that names only one skill', async () => {
		const source = withoutRules(talentedResearcher);
		source.system.rules.push(
			gmRule({ type: 'situationalRollMode', checkType: 'skillCheck', skills: ['arcana'] }),
		);

		await migration.updateItem(source);

		expect(source.system.rules).toHaveLength(2);
	});

	it('changes nothing on a second run', async () => {
		const source = withoutRules(talentedResearcher);

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});

	it('matches a world copy that lost its compendium id, by class and name', async () => {
		const source = withoutRules(talentedResearcher);
		source.name = 'talented researcher';

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(talentedResearcher.system.rules);
	});

	it('rejects a same-named feature belonging to another class', async () => {
		const source = withoutRules(talentedResearcher);
		source.system.class = 'shepherd';

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
	});

	it('rejects a same-named feature carrying another compendium id', async () => {
		const source = withoutRules(talentedResearcher);
		source._stats = { compendiumSource: 'Compendium.homebrew.features.Item.0000000000000001' };

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
	});

	it('matches the copy embedded on a character, which carries the compendium id', async () => {
		const source = withoutRules(talentedResearcher);
		source.name = 'Renamed By The Player';
		source.system.class = '';
		source._stats = {
			compendiumSource: 'Compendium.nimble.nimble-class-features.Item.WN4gldrDqbvGcNOl',
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(talentedResearcher.system.rules);
	});

	it('matches the dev build, which stores its own system namespace', async () => {
		const source = withoutRules(talentedResearcher);
		source.name = 'Renamed By The Player';
		source.system.class = '';
		source._stats = {
			compendiumSource: 'Compendium.nimble-dev.nimble-class-features.Item.WN4gldrDqbvGcNOl',
		};

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(talentedResearcher.system.rules);
	});
});

describe('Migration053MageShepherdPilot: Searing Light', () => {
	it('adds the use pool and its cost the pack ships', async () => {
		const source = withoutRules(searingLight);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(searingLight.system.rules);
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves a copy that already carries the packaged rules alone', async () => {
		const source = structuredClone(searingLight) as any;

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(searingLight.system.rules);
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a GM pool keyed to searing-light without adding a second one', async () => {
		const authored = gmRule({ type: 'chargePool', identifier: 'searing-light', max: '3' });
		const source = withoutRules(searingLight);
		source.system.rules.push(authored);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored]);
	});

	it('adds the pool beside a GM consumer aimed at another pool', async () => {
		const authored = gmRule({ type: 'chargeConsumer', poolIdentifier: 'divine-favor' });
		const source = withoutRules(searingLight);
		source.system.rules.push(authored);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored, ...searingLight.system.rules]);
	});

	it('adds both rules beside an unrelated GM rule and keeps it', async () => {
		const authored = gmRule({ label: 'GM note' });
		const source = withoutRules(searingLight);
		source.system.rules.push(authored);

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([authored, ...searingLight.system.rules]);
	});

	it('changes nothing on a second run', async () => {
		const source = withoutRules(searingLight);

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});

	it('matches a world copy that lost its compendium id, by class and name', async () => {
		const source = withoutRules(searingLight);
		source.name = 'searing light ';

		await migration.updateItem(source);

		expect(source.system.rules).toEqual(searingLight.system.rules);
	});

	it('rejects a same-named feature belonging to another class', async () => {
		const source = withoutRules(searingLight);
		source.system.class = 'mage';

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
	});
});

describe('Migration053MageShepherdPilot: descriptions', () => {
	it.each([
		['Spell Shaper', spellShaper],
		['Sacred Graces', sacredGraces],
	])('gives an empty %s the description the pack ships', async (_name, packItem) => {
		const source = withoutDescription(packItem);

		await migration.updateItem(source);

		expect(source.system.description).toBe(packItem.system.description);
		expect(log).toHaveBeenCalledOnce();
	});

	it.each([
		['Spell Shaper', spellShaper],
		['Sacred Graces', sacredGraces],
	])('keeps a GM description already written on %s', async (_name, packItem) => {
		const source = withoutDescription(packItem);
		source.system.description = '<p>Our table wording.</p>';

		await migration.updateItem(source);

		expect(source.system.description).toBe('<p>Our table wording.</p>');
		expect(log).not.toHaveBeenCalled();
	});

	it('changes nothing on a second run', async () => {
		const source = withoutDescription(spellShaper);

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});

	it('matches a world copy that lost its compendium id, by class and name', async () => {
		const source = withoutDescription(sacredGraces);
		source.name = 'sacred graces';

		await migration.updateItem(source);

		expect(source.system.description).toBe(sacredGraces.system.description);
	});

	it('rejects a same-named feature belonging to another class', async () => {
		const source = withoutDescription(spellShaper);
		source.system.class = 'shepherd';

		await migration.updateItem(source);

		expect(source.system.description).toBe('');
	});
});

describe('Migration053MageShepherdPilot: Lifebinding Spirit', () => {
	it('clears the material component the pack no longer carries', async () => {
		const source = withOldCostDetails(lifebindingSpirit);

		await migration.updateItem(source);

		expect(source.system.activation.cost.details).toBe(
			lifebindingSpirit.system.activation.cost.details,
		);
		expect(log).toHaveBeenCalledOnce();
	});

	it('leaves a copy the pack already updated alone', async () => {
		const source = structuredClone(lifebindingSpirit) as any;

		await migration.updateItem(source);

		expect(source.system.activation.cost.details).toBe('');
		expect(log).not.toHaveBeenCalled();
	});

	it('keeps a GM component line the table wrote', async () => {
		const source = withOldCostDetails(lifebindingSpirit);
		source.system.activation.cost.details = 'A ruby worth at least 100 gp';

		await migration.updateItem(source);

		expect(source.system.activation.cost.details).toBe('A ruby worth at least 100 gp');
		expect(log).not.toHaveBeenCalled();
	});

	it('changes nothing on a second run', async () => {
		const source = withOldCostDetails(lifebindingSpirit);

		await migration.updateItem(source);
		const afterFirstRun = structuredClone(source);
		await migration.updateItem(source);

		expect(source).toEqual(afterFirstRun);
	});

	it('matches a world copy that lost its compendium id, by name', async () => {
		const source = withOldCostDetails(lifebindingSpirit);
		source.name = 'lifebinding spirit';

		await migration.updateItem(source);

		expect(source.system.activation.cost.details).toBe('');
	});

	it('rejects a feature that shares the spell name', async () => {
		const source = withOldCostDetails(lifebindingSpirit);
		source.type = 'feature';

		await migration.updateItem(source);

		expect(source.system.activation.cost.details).toBe(OLD_COST_DETAILS);
	});
});

describe('Migration053MageShepherdPilot: pack snapshots', () => {
	it('adds exactly the rules the packs ship', async () => {
		const researcher = withoutRules(talentedResearcher);
		const light = withoutRules(searingLight);

		await migration.updateItem(researcher);
		await migration.updateItem(light);

		expect(researcher.system.rules).toEqual(talentedResearcher.system.rules);
		expect(light.system.rules).toEqual(searingLight.system.rules);
	});

	it('writes exactly the descriptions the packs ship', async () => {
		const shaper = withoutDescription(spellShaper);
		const graces = withoutDescription(sacredGraces);

		await migration.updateItem(shaper);
		await migration.updateItem(graces);

		expect(shaper.system.description).toBe(spellShaper.system.description);
		expect(graces.system.description).toBe(sacredGraces.system.description);
	});

	it('clears the cost details the pack now leaves empty', () => {
		expect(lifebindingSpirit.system.activation.cost.details).toBe('');
	});

	it('leaves an unrelated item untouched', async () => {
		const source = { type: 'feature', name: 'Bolster', system: { class: 'mage', rules: [] } };

		await migration.updateItem(source);

		expect(source.system.rules).toEqual([]);
		expect(log).not.toHaveBeenCalled();
	});
});
