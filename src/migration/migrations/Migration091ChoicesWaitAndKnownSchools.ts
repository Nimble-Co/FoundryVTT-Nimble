import { isCompendiumId, SNAPSHOT_PREFIX, toPackSourceId } from '../compendiumSourceId.js';
import { MigrationBase, type MigrationKind } from '../MigrationBase.js';

type Json = Record<string, any>;

interface PackFeature {
	sourceId: string;
	name: string;
	classIdentifier: string;
}

const FEATURES = `${SNAPSHOT_PREFIX}nimble-class-features.Item.`;

const PRIMORDIAL_FORCE: PackFeature = {
	sourceId: `${FEATURES}bjcXn5Lgr6FNoyuR`,
	name: 'primordial force',
	classIdentifier: 'stormshifter',
};

const WINDBAG: PackFeature = {
	sourceId: `${FEATURES}fg1cWHw1YLF2Mcc0`,
	name: 'windbag',
	classIdentifier: 'songweaver',
};

/** The steps of Primordial Force as the pack shipped them before the Ice and Wind steps waited. */
const OLD_PRIMORDIAL_FORCE_STEPS: Json[] = [
	{
		id: 'uoktkenF4vkQs3Li',
		type: 'healing',
		healingType: 'tempHealing',
		formula: '@will',
		recipient: 'self',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'iCiDslSzYetvBvke',
		type: 'damage',
		damageType: '',
		formula: '@will',
		canCrit: false,
		canMiss: false,
		parentContext: null,
		parentNode: null,
		on: {
			hit: [
				{
					id: '3YsilhhjwhfVU2ih',
					type: 'damageOutcome',
					outcome: 'fullDamage',
					parentContext: 'hit',
					parentNode: 'iCiDslSzYetvBvke',
				},
			],
		},
	},
	{
		id: 'e0EjxAqgWHj22YhM',
		type: 'healing',
		healingType: 'healing',
		formula: '@will',
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'X68b2Yr6WIElmhNw',
		type: 'applyEffect',
		effectId: '2O0NMTS096pDQNJa',
		recipient: 'self',
		tempHealingNodeId: null,
		waitsForClick: true,
		parentContext: null,
		parentNode: null,
	},
	{
		id: 'evFXvKTfH5Ho7GHX',
		type: 'move',
		kind: 'free',
		recipient: 'self',
		distance: '6',
		distanceBySize: {},
		ignoreDifficultTerrain: false,
		upTo: true,
		direction: 'any',
		parentContext: null,
		parentNode: null,
	},
];

/** The Ice temp HP waits for its button now. */
const ICE_STEP = 'uoktkenF4vkQs3Li';

/** The Wind effect gives the Wind move now, so the move waits for the effect. */
const WIND_STEP = 'X68b2Yr6WIElmhNw';
const WIND_MOVE_STEP = 'evFXvKTfH5Ho7GHX';

function windbagPick(id: string, label: string, level: number): Json {
	return {
		id,
		type: 'grantSpells',
		schools: ['known'],
		tiers: [0],
		mode: 'selectSpell',
		count: 1,
		utilityOnly: true,
		label,
		predicate: { level: { min: level } },
	};
}

const WINDBAG_PICKS: Json[] = [
	windbagPick('windbag-l3-utility', 'Windbag: Choose a Utility Spell', 3),
	windbagPick('windbag-l6-utility', 'Windbag (2): Choose a 2nd Utility Spell', 6),
];

/** The value with its object keys in order, so two values compare by content. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value as Json)
				.sort()
				.map((key) => [key, canonical((value as Json)[key])]),
		);
	}
	return value;
}

function sameContent(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function isUtilitySpell(spell: Json): boolean {
	const selected = spell.system?.properties?.selected;
	return Array.isArray(selected) && selected.includes('utilitySpell');
}

/**
 * Primordial Force gets the new pack steps while its steps are the old pack value. Windbag gets
 * its utility spell choices. A school choice rule gets the school that the character's spells
 * show, when they show it with no doubt.
 */
class Migration091ChoicesWaitAndKnownSchools extends MigrationBase {
	static override readonly version = 91;

	override readonly version = Migration091ChoicesWaitAndKnownSchools.version;

	override readonly title = 'Primordial Force waits for a pick, and chosen schools are known';

	override readonly kind: MigrationKind = 'content';

	override async updateItem(source: any): Promise<void> {
		if (source?.type !== 'feature' || !source.system) return;
		if (this.#matches(source, PRIMORDIAL_FORCE)) this.#makeStepsWait(source);
		else if (this.#matches(source, WINDBAG)) this.#addWindbagPicks(source);
	}

	override async alwaysUpdateItem(source: any, parent?: any): Promise<void> {
		if (parent?.type !== 'character' || !Array.isArray(source?.system?.rules)) return;
		const spells = (Array.isArray(parent.items) ? parent.items : []).filter(
			(item: Json) => item?.type === 'spell',
		);
		const level = parent.system?.classData?.levels?.length ?? 0;
		for (const rule of source.system.rules as Json[]) {
			const chosen = this.#inferChosenSchools(rule, spells, level);
			if (!chosen) continue;
			rule.chosenSchools = chosen;
			console.log(`Nimble Migration | ${source.name}: chose ${chosen.join(', ')}`);
		}
	}

	#matches(source: Json, feature: PackFeature): boolean {
		const sourceId = toPackSourceId(this.getSourceId(source));
		if (isCompendiumId(sourceId)) return sourceId === feature.sourceId;
		const name = typeof source.name === 'string' ? source.name.trim().toLowerCase() : '';
		return name === feature.name && source.system?.class === feature.classIdentifier;
	}

	#makeStepsWait(source: Json): void {
		const steps = source.system.activation?.effects;
		if (!Array.isArray(steps) || !sameContent(steps, OLD_PRIMORDIAL_FORCE_STEPS)) return;
		for (const step of steps) {
			if (step.id === ICE_STEP) step.waitsForClick = true;
			if (step.id === WIND_STEP) step.moveNodeId = WIND_MOVE_STEP;
		}
		console.log(`Nimble Migration | ${source.name}: each element waits for its button`);
	}

	#addWindbagPicks(source: Json): void {
		const rules = source.system.rules;
		if (!Array.isArray(rules)) return;
		const hasPick = rules.some(
			(rule: Json) => rule?.type === 'grantSpells' && rule.mode === 'selectSpell',
		);
		if (hasPick) return;
		rules.unshift(...WINDBAG_PICKS.map((rule) => foundry.utils.deepClone(rule)));
		console.log(`Nimble Migration | ${source.name}: utility spell choices at levels 3 and 6`);
	}

	#inferChosenSchools(rule: Json, spells: Json[], level: number): string[] | null {
		if (rule?.type !== 'grantSpells' || rule.mode !== 'selectSchool') return null;
		const minLevel = rule.predicate?.level?.min;
		if (typeof minLevel === 'number' && minLevel > level) return null;
		if (Array.isArray(rule.chosenSchools) && rule.chosenSchools.length > 0) return null;
		const schools: unknown = rule.schools;
		if (!Array.isArray(schools) || schools.length === 0 || schools.includes('known')) return null;

		const tiers: unknown[] = Array.isArray(rule.tiers) ? rule.tiers : [0];
		const utilityOnly = rule.utilityOnly === true;
		const count = Number(rule.count) || 1;
		const withSpells = schools.filter((school) =>
			spells.some(
				(spell) =>
					spell.system?.school === school &&
					tiers.includes(spell.system?.tier) &&
					isUtilitySpell(spell) === utilityOnly,
			),
		);
		return withSpells.length === count ? withSpells : null;
	}
}

export { Migration091ChoicesWaitAndKnownSchools };
