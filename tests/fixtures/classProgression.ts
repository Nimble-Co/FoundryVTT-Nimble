import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import getClassFeaturesFromIndex, {
	buildClassFeatureIndex as buildClassFeatureIndexReal,
	type ClassFeatureIndex,
} from '../../src/utils/getClassFeatures.ts';

/**
 * Shared harness for class-progression integration tests.
 *
 * It reads the real compendium JSON from `packs/` on disk, installs lightweight
 * `game.packs` / `fromUuid` mocks that expose that data the same way Foundry would,
 * and then drives the REAL feature resolver (`buildClassFeatureIndex` +
 * `getClassFeaturesFromIndex`). Tests therefore exercise production code, not a
 * re-implementation of it.
 */

const ROOT = process.cwd();
const CLASSES_DIR = join(ROOT, 'packs/classes/core');
const FEATURES_DIR = join(ROOT, 'packs/classFeatures/core');

// `buildClassFeatureIndex` is the default export's sibling; re-export the named one.
export { buildClassFeatureIndexReal as buildClassFeatureIndex };
export { getClassFeaturesFromIndex };

export interface FeatureDoc {
	uuid: string;
	_id: string;
	type: 'feature';
	name: string;
	img: string;
	system: Record<string, any>;
}

export interface ClassMeta {
	name: string;
	identifier: string;
	hitDieSize: number;
	startingHp: number;
	keyAbilityScores: string[];
	savingThrows: { advantage: string; disadvantage: string };
	groupIdentifiers: string[];
	abilityScoreData: Record<string, { type: string; statIncreaseType: string }>;
	startingGear: string[];
	caster: boolean;
	manaFormula: string;
	subclassGroups: string[];
	subclassSelectLevel: number | null;
	raw: Record<string, any>;
}

const STARTING_HP_BY_HIT_DIE: Record<number, number> = { 4: 7, 6: 10, 8: 13, 10: 17, 12: 20 };

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else if (entry.name.endsWith('.json')) out.push(full);
	}
	return out;
}

function readJson(path: string): Record<string, any> {
	return JSON.parse(readFileSync(path, 'utf-8'));
}

let cachedFeatures: FeatureDoc[] | null = null;

/** All class-feature documents from `packs/classFeatures`, as Foundry-shaped docs. */
export function loadAllFeatureDocs(): FeatureDoc[] {
	if (cachedFeatures) return cachedFeatures;
	cachedFeatures = walk(FEATURES_DIR).map((path) => {
		const doc = readJson(path);
		return {
			uuid: `Item.${doc._id}`,
			_id: doc._id,
			type: 'feature' as const,
			name: doc.name,
			img: doc.img ?? 'icons/svg/item-bag.svg',
			system: doc.system ?? {},
		};
	});
	return cachedFeatures;
}

let cachedClasses: ClassMeta[] | null = null;

/** All class documents from `packs/classes`, enriched with derived metadata. */
export function loadAllClasses(): ClassMeta[] {
	if (cachedClasses) return cachedClasses;
	const features = loadAllFeatureDocs();
	cachedClasses = readdirSync(CLASSES_DIR)
		.filter((f) => f.endsWith('.json'))
		.map((file) => {
			const raw = readJson(join(CLASSES_DIR, file));
			const s = raw.system;
			const id = s.identifier;
			const subclassGroups = new Set<string>();
			let subclassSelectLevel: number | null = null;

			for (const f of features) {
				if (f.system.class !== id) continue;
				if (!f.system.subclass) continue;
				subclassGroups.add(f.system.group);
				const levels = f.system.gainedAtLevels?.length
					? f.system.gainedAtLevels
					: f.system.gainedAtLevel
						? [f.system.gainedAtLevel]
						: [];
				for (const lvl of levels) {
					if (subclassSelectLevel === null || lvl < subclassSelectLevel) subclassSelectLevel = lvl;
				}
			}

			const mana = s.mana ?? {};
			return {
				name: raw.name,
				identifier: id,
				hitDieSize: s.hitDieSize,
				startingHp: STARTING_HP_BY_HIT_DIE[s.hitDieSize],
				keyAbilityScores: s.keyAbilityScores ?? [],
				savingThrows: s.savingThrows,
				groupIdentifiers: s.groupIdentifiers ?? [],
				abilityScoreData: s.abilityScoreData ?? {},
				startingGear: (s.rules ?? [])
					.filter((r: any) => r.type === 'grantItem')
					.map((r: any) => (r.label ?? '').replace(/^Starting Gear - /, '') || r.identifier),
				caster: Boolean(mana.formula && String(mana.formula).trim()),
				manaFormula: mana.formula ?? '',
				subclassGroups: [...subclassGroups].sort(),
				subclassSelectLevel,
				raw,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
	return cachedClasses;
}

export function getClassMeta(identifier: string): ClassMeta {
	const cls = loadAllClasses().find((c) => c.identifier === identifier);
	if (!cls) throw new Error(`Unknown class identifier: ${identifier}`);
	return cls;
}

/**
 * Installs `game.packs` and `globalThis.fromUuid` mocks backed by the on-disk
 * compendium data, then returns a real feature index built by production code.
 *
 * Call inside a test (or `beforeAll`); pair with {@link restoreMocks} in cleanup.
 */
export async function buildRealIndex(): Promise<ClassFeatureIndex> {
	const features = loadAllFeatureDocs();
	const docsByUuid = new Map(features.map((f) => [f.uuid, f]));

	const packIndex = features.map((f) => ({
		_id: f._id,
		uuid: f.uuid,
		type: 'feature',
		name: f.name,
		system: {
			class: f.system.class,
			subclass: f.system.subclass,
			gainedAtLevel: f.system.gainedAtLevel,
			gainedAtLevels: f.system.gainedAtLevels,
			group: f.system.group,
			selectionCountByLevel: f.system.selectionCountByLevel,
		},
	}));

	const fakePack = {
		documentName: 'Item',
		async getIndex() {
			return packIndex;
		},
	};

	const g = globalThis as any;
	g.__originalPacks = g.game.packs;
	g.__originalItems = g.game.items;
	g.__originalFromUuid = g.fromUuid;
	g.game.packs = [fakePack];
	g.game.items = [];
	g.fromUuid = async (uuid: string) => docsByUuid.get(uuid) ?? null;

	return buildClassFeatureIndexReal();
}

/** Restores globals mutated by {@link buildRealIndex}. */
export function restoreMocks(): void {
	const g = globalThis as any;
	if (g.__originalPacks !== undefined) g.game.packs = g.__originalPacks;
	if (g.__originalItems !== undefined) g.game.items = g.__originalItems;
	g.fromUuid = g.__originalFromUuid;
}

/**
 * Convenience: resolve the grants a class receives at a single level, driving the
 * real resolver with the class's own group identifiers.
 */
export async function resolveLevel(
	index: ClassFeatureIndex,
	identifier: string,
	level: number,
	ownedFeatureUuids: ReadonlySet<string> = new Set<string>(),
) {
	const meta = getClassMeta(identifier);
	return getClassFeaturesFromIndex(
		index,
		identifier,
		level,
		{ ownedFeatureUuids },
		meta.groupIdentifiers,
	);
}

/** A pool of features offered for selection at one level. */
export interface OfferedGroup {
	/** How many features the player must pick from this group at this level. */
	selectionCount: number;
	/** Names of the features available to pick (owned features already removed). */
	options: string[];
}

/** One `levelUpOptions` entry on a feature. */
export interface LevelUpOption {
	id?: string;
	label?: string;
	applyAtLevels?: number[];
	rules?: unknown[];
	selectionGroups?: string[];
	selectionCount?: number;
}

/**
 * A single #708 alternative offered at a level: "choose one option OR another". An
 * option may draw picks from the combined union of its `selectionGroups`, or carry
 * no pool at all (a flat rule like "+1 Max Combat Die").
 */
export interface OfferedOption {
	/** The progression feature presenting this option (e.g. "Fit for Any Battlefield"). */
	featureName: string;
	/** The option's display label (e.g. "Choose a Combat Ability"). */
	label?: string;
	/** Groups whose features form ONE combined pool for this option. */
	selectionGroups: string[];
	/** How many picks this option draws from its combined pool. */
	selectionCount: number;
	/** True when the option applies a flat rule instead of (or as well as) a pool pick. */
	hasRules: boolean;
}

/** What a character is offered / granted when leveling to a single level. */
export interface LevelSummary {
	level: number;
	/** Features newly auto-granted at this level (already-owned repeats removed). */
	newAutoGrants: string[];
	/**
	 * Every selectable pool offered at this level, keyed by group name — whether it
	 * surfaces as a plain selection group or is presented through a #708 option
	 * feature's picker. This is the "effective" set of choices the player sees.
	 *
	 * NOTE: when a #708 option combines several groups into ONE pick (e.g. Commander's
	 * "Choose a Combat Ability" spanning combat-tactics + commanders-orders), each group
	 * appears here separately, but only ONE pick total is drawn from their union — see
	 * `offeredOptions` for the authoritative per-choice picture.
	 */
	offeredGroups: Record<string, OfferedGroup>;
	/** #708 progression features that present an option picker at this level. */
	optionFeatureNames: string[];
	/** The #708 alternatives offered this level ("choose one OR another"). */
	offeredOptions: OfferedOption[];
	/** Ability-score increase type at this level, from the class definition, if any. */
	asi: string | null;
	/** True when this is the level the class first chooses a subclass. */
	isSubclassSelectLevel: boolean;
}

// group -> level -> feature docs (non-subclass pool features), for simulating picks.
let cachedGroupIndex: Map<string, Map<number, FeatureDoc[]>> | null = null;
function groupFeatureIndex(): Map<string, Map<number, FeatureDoc[]>> {
	if (cachedGroupIndex) return cachedGroupIndex;
	const idx = new Map<string, Map<number, FeatureDoc[]>>();
	for (const f of loadAllFeatureDocs()) {
		if (f.system.subclass) continue;
		const group = f.system.group;
		if (!group) continue;
		const levels: number[] = f.system.gainedAtLevels?.length
			? f.system.gainedAtLevels
			: f.system.gainedAtLevel
				? [f.system.gainedAtLevel]
				: [];
		for (const lvl of levels) {
			if (!idx.has(group)) idx.set(group, new Map());
			const lvlMap = idx.get(group)!;
			if (!lvlMap.has(lvl)) lvlMap.set(lvl, []);
			lvlMap.get(lvl)!.push(f);
		}
	}
	cachedGroupIndex = idx;
	return idx;
}

/**
 * Simulates a character of the given class being created (level 1) and leveled up
 * through level 20, driving the REAL resolver at each step and forwarding owned
 * features the way the level-up flow does. Returns one {@link LevelSummary} per
 * level (index 0 == level 1).
 *
 * Picks are made deterministically (first options by name) purely so that owned
 * features are forwarded realistically; tests should assert on which groups are
 * offered and their counts, not on the arbitrary picks themselves.
 */
export async function simulateProgression(
	index: ClassFeatureIndex,
	identifier: string,
): Promise<LevelSummary[]> {
	const meta = getClassMeta(identifier);
	const gIndex = groupFeatureIndex();
	const owned = new Set<string>();
	const summaries: LevelSummary[] = [];

	for (let level = 1; level <= 20; level++) {
		const res = await getClassFeaturesFromIndex(
			index,
			identifier,
			level,
			{ ownedFeatureUuids: owned },
			meta.groupIdentifiers,
		);

		const newAutoGrants = res.autoGrant.map((f) => f.name);
		for (const f of res.autoGrant) owned.add(f.uuid);

		const offeredGroups: Record<string, OfferedGroup> = {};

		// Direct selection groups.
		for (const [group, sel] of res.selectionGroups) {
			offeredGroups[group] = {
				selectionCount: sel.selectionCount,
				options: sel.features.map((f) => f.name),
			};
			for (let i = 0; i < sel.selectionCount && i < sel.features.length; i++) {
				owned.add(sel.features[i].uuid);
			}
		}

		// #708 option features: a progression feature presents one or more alternative
		// options ("choose one option OR another"). The player picks exactly ONE
		// alternative; an option may draw `selectionCount` picks from the COMBINED union
		// of its `selectionGroups`, or carry no pool at all (e.g. a flat "+1 Max Combat Die").
		const optionFeatureNames = res.optionFeatures.map((f) => f.name);
		const offeredOptions: OfferedOption[] = [];
		for (const optFeature of res.optionFeatures) {
			owned.add(optFeature.uuid);
			const applicable = (optFeature.system.levelUpOptions ?? []).filter(
				(opt: LevelUpOption) => !opt.applyAtLevels?.length || opt.applyAtLevels.includes(level),
			);

			// Record every alternative and the pool it could draw from, owned-filtered, so
			// tests see full availability at the start of the level. An option that combines
			// several groups (e.g. "Choose a Combat Ability" over combat-tactics +
			// commanders-orders) is ONE pool: keyed by the joined group name, with the union
			// of both groups' options — so the pick count is measured against the union, not
			// each group in isolation.
			for (const opt of applicable) {
				const count = typeof opt.selectionCount === 'number' ? opt.selectionCount : 1;
				const groups = opt.selectionGroups ?? [];
				offeredOptions.push({
					featureName: optFeature.name,
					label: opt.label,
					selectionGroups: [...groups],
					selectionCount: count,
					hasRules: (opt.rules ?? []).length > 0,
				});
				if (groups.length === 0) continue;
				const seen = new Set<string>();
				const unionNames: string[] = [];
				for (const group of groups) {
					for (const f of gIndex.get(group)?.get(level) ?? []) {
						if (!owned.has(f.uuid) && !seen.has(f.uuid)) {
							seen.add(f.uuid);
							unionNames.push(f.name);
						}
					}
				}
				const key = groups.length === 1 ? groups[0] : groups.join('+');
				offeredGroups[key] = { selectionCount: count, options: unionNames };
			}

			// Simulate the player picking ONE alternative — prefer one that draws from a
			// pool so pools get exercised — and consume its picks from the combined union.
			const chosen =
				applicable.find((opt) => (opt.selectionGroups ?? []).length > 0) ?? applicable[0];
			if (chosen) {
				const count = typeof chosen.selectionCount === 'number' ? chosen.selectionCount : 1;
				const seen = new Set<string>();
				const unionPool: FeatureDoc[] = [];
				for (const group of chosen.selectionGroups ?? []) {
					for (const f of gIndex.get(group)?.get(level) ?? []) {
						if (!owned.has(f.uuid) && !seen.has(f.uuid)) {
							seen.add(f.uuid);
							unionPool.push(f);
						}
					}
				}
				for (let i = 0; i < count && i < unionPool.length; i++) owned.add(unionPool[i].uuid);
			}
		}

		summaries.push({
			level,
			newAutoGrants,
			offeredGroups,
			optionFeatureNames,
			offeredOptions,
			asi: meta.abilityScoreData[String(level)]?.statIncreaseType ?? null,
			isSubclassSelectLevel: level === meta.subclassSelectLevel,
		});
	}

	return summaries;
}
