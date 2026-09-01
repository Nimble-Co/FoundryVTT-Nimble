/**
 * Builds a character the way the system would, without driving the creation
 * wizard's nine steps.
 *
 * The split between what is granted automatically and what the player picks is
 * not guessed here: `getMissingLevelSelections()` reports the pools a character
 * is owed picks from, and every feature outside those pools is automatic. The
 * picks themselves are then granted by `applyLevelCorrection()`, which is the
 * system's own repair path. Nothing about class progression is reimplemented,
 * so the helper works for any class rather than the ones it was written against.
 */

import { settle } from '../liveHelpers.ts';

export interface CharacterSpec {
	name: string;
	className: string;
	level?: number;
	ancestryName?: string;
	backgroundName?: string;
	subclassName?: string;
	/** Ability score modifiers, defaulting to a workable spread. */
	abilities?: Partial<Record<'strength' | 'dexterity' | 'intelligence' | 'will', number>>;
}

interface IndexEntry {
	_id: string;
	name: string;
	system?: {
		class?: string;
		subclass?: string;
		group?: string;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
	};
}

const FEATURE_INDEX_FIELDS = [
	'system.class',
	'system.subclass',
	'system.group',
	'system.gainedAtLevel',
	'system.gainedAtLevels',
];

async function packIndex(packName: string, fields: string[] = []): Promise<IndexEntry[]> {
	const pack = game.packs.get(`${game.system.id}.${packName}`);
	if (!pack) throw new Error(`no pack ${packName}`);
	const index = await pack.getIndex({ fields } as never);
	return [...(index as unknown as { contents: IndexEntry[] }).contents];
}

async function addFromPack(
	actor: CharacterActor,
	packName: string,
	entries: IndexEntry[],
): Promise<void> {
	if (!entries.length) return;
	const pack = game.packs.get(`${game.system.id}.${packName}`)!;
	const sources: object[] = [];
	for (const entry of entries) {
		const doc = await pack.getDocument(entry._id);
		if (!doc) continue;
		const source = (doc as Item).toObject() as Record<string, unknown>;
		// Stamp the origin the way an imported document carries it, so the
		// system can tell where the item came from.
		source._stats = {
			...((source._stats as object) ?? {}),
			compendiumSource: `Compendium.${game.system.id}.${packName}.Item.${entry._id}`,
		};
		sources.push(source);
	}
	await actor.createEmbeddedDocuments('Item', sources as never);
}

function byName(entries: IndexEntry[], name: string, label: string): IndexEntry {
	const match = entries.find((entry) => entry.name === name);
	if (!match) throw new Error(`no ${label} named "${name}"`);
	return match;
}

/** The levels a feature is granted at, from either of the two authored shapes. */
function grantLevels(entry: IndexEntry): number[] {
	const many = entry.system?.gainedAtLevels;
	if (Array.isArray(many) && many.length) return many;
	const one = entry.system?.gainedAtLevel;
	return typeof one === 'number' ? [one] : [];
}

interface MissingSelection {
	level: number;
	poolKey: string;
	poolGroups: string[];
	/** How many picks the character still owes from this pool. */
	missingCount: number;
	candidateUuids: string[];
}

/**
 * The parts of a built character a test reads. Declared here so test files do
 * not each restate the same shape.
 */
export interface CharacterActor {
	id: string;
	name: string;
	classes: Record<string, { id: string; identifier: string }>;
	levels: { character: number };
	items: {
		contents: Array<{
			id: string;
			name: string;
			type: string;
			flags: Record<string, Record<string, unknown>>;
			rules?: Map<string, Record<string, unknown>>;
		}>;
	};
	system: {
		classData: { levels: string[] };
		resources: {
			mana: { current: number; max: number };
			highestUnlockedSpellTier: number | null;
		};
	};
	update(changes: Record<string, unknown>): Promise<unknown>;
	updateItem(itemId: string, changes: Record<string, unknown>): Promise<unknown>;
	createEmbeddedDocuments(embeddedName: string, data: object[]): Promise<unknown>;
	getMissingLevelSelections(): Promise<MissingSelection[]>;
	applyLevelCorrection(selections: Array<{ level: number; uuids: string[] }>): Promise<void>;
}

export async function buildCharacter(spec: CharacterSpec): Promise<CharacterActor> {
	const level = spec.level ?? 1;
	const abilities = { strength: 1, dexterity: 3, intelligence: 3, will: 1, ...spec.abilities };

	const actor = (await Actor.create({
		name: spec.name,
		type: 'character',
		system: {
			abilities: Object.fromEntries(
				Object.entries(abilities).map(([key, value]) => [key, { baseValue: value }]),
			),
		},
	} as never)) as unknown as CharacterActor;

	// Origins first: the real creation path resolves these before any feature,
	// so a pool whose maximum reads an ability score seeds from a real value.
	const classes = await packIndex('nimble-classes');
	await addFromPack(actor, 'nimble-classes', [byName(classes, spec.className, 'class')]);

	if (spec.ancestryName) {
		const ancestries = await packIndex('nimble-ancestries');
		await addFromPack(actor, 'nimble-ancestries', [
			byName(ancestries, spec.ancestryName, 'ancestry'),
		]);
	}
	if (spec.backgroundName) {
		const backgrounds = await packIndex('nimble-backgrounds');
		await addFromPack(actor, 'nimble-backgrounds', [
			byName(backgrounds, spec.backgroundName, 'background'),
		]);
	}
	if (spec.subclassName) {
		const subclasses = await packIndex('nimble-subclasses');
		await addFromPack(actor, 'nimble-subclasses', [
			byName(subclasses, spec.subclassName, 'subclass'),
		]);
	}
	await settle();

	await levelCharacterTo(actor, level);

	return actor;
}

/**
 * Takes an existing character up to a level, granting everything the levels in
 * between hand out. Levelling down is not supported: nothing here removes what
 * a level already gave.
 */
export async function levelCharacterTo(actor: CharacterActor, level: number): Promise<void> {
	await setLevel(actor, level);
	await grantAutomaticFeatures(actor, level);
	await grantOwedPicks(actor);
	await grantAutomaticSpells(actor);
}

/** The two writes the level-up path makes once its dialog has closed. */
async function setLevel(actor: CharacterActor, level: number): Promise<void> {
	const characterClass = Object.values(actor.classes)[0];
	if (!characterClass) throw new Error('the character has no class');
	await actor.updateItem(characterClass.id, { 'system.classLevel': level });
	await actor.update({
		'system.classData.levels': Array.from({ length: level }, () => characterClass.identifier),
		'system.levelUpHistory': Array.from({ length: Math.max(0, level - 1) }, (_, index) => ({
			level: index + 2,
			hpIncrease: 0,
			abilityIncreases: {},
			skillIncreases: {},
			hitDieAdded: false,
			classIdentifier: characterClass.identifier,
			grantedFeatureIds: [],
			grantedSpellIds: [],
			poolMaxBonuses: {},
		})),
	} as never);
	await settle();
}

/**
 * Everything the class and any chosen subclass grant on the way to this level,
 * excluding the pools the system reports as the player's to choose from.
 */
async function grantAutomaticFeatures(actor: CharacterActor, level: number): Promise<void> {
	const poolGroups = new Set(
		(await actor.getMissingLevelSelections()).flatMap((gap) => gap.poolGroups),
	);

	const owned = new Set(
		(actor.items as unknown as { contents: Array<{ name: string }> }).contents.map((i) => i.name),
	);
	const identifiers = new Set(
		(
			actor.items as unknown as {
				contents: Array<{ type: string; system?: { identifier?: string } }>;
			}
		).contents
			.filter((i) => i.type === 'class' || i.type === 'subclass')
			.map((i) => i.system?.identifier ?? ''),
	);

	const features = await packIndex('nimble-class-features', FEATURE_INDEX_FIELDS);
	const automatic = features.filter((entry) => {
		const group = entry.system?.group ?? '';
		if (poolGroups.has(group)) return false;
		if (owned.has(entry.name)) return false;

		const featureClass = entry.system?.class ?? '';
		const featureSubclass = entry.system?.subclass ?? '';
		if (featureSubclass && !identifiers.has(featureSubclass)) return false;
		if (!featureSubclass && featureClass && !identifiers.has(featureClass)) return false;
		if (!featureClass && !featureSubclass) return false;

		return grantLevels(entry).some((granted) => granted <= level);
	});

	await addFromPack(actor, 'nimble-class-features', automatic);
	await settle();
}

/** Lets the system grant the picks a character of this level is owed. */
async function grantOwedPicks(actor: CharacterActor): Promise<void> {
	for (let pass = 0; pass < 6; pass += 1) {
		const gaps = await actor.getMissingLevelSelections();
		if (!gaps.length) return;

		const selections = gaps
			.map((gap) => ({
				level: gap.level,
				uuids: gap.candidateUuids.slice(0, Math.max(0, gap.missingCount)),
			}))
			.filter((selection) => selection.uuids.length > 0);
		if (!selections.length) return;

		await actor.applyLevelCorrection(selections);
		await settle();
	}
}

/**
 * The spells the character's own features hand out without asking.
 *
 * A `grantSpells` rule in `auto` mode names the spells outright, so they are
 * read from the items the character already holds rather than derived from the
 * class. Rules that ask the player to choose a school are left alone: those are
 * a selection, not a grant.
 */
async function grantAutomaticSpells(actor: CharacterActor): Promise<void> {
	const owned = actor.items as unknown as {
		contents: Array<{ name: string; rules?: Map<string, Record<string, unknown>> }>;
	};
	const ownedNames = new Set(owned.contents.map((item) => item.name));

	const uuids = new Set<string>();
	for (const item of owned.contents) {
		for (const rule of item.rules?.values() ?? []) {
			if (rule.type !== 'grantSpells' || rule.mode !== 'auto') continue;
			for (const uuid of (rule.uuids as string[]) ?? []) uuids.add(uuid);
		}
	}
	if (!uuids.size) return;

	const sources: object[] = [];
	for (const uuid of uuids) {
		const spell = await fromUuid(uuid as `Item.${string}`);
		if (!spell) continue;
		const source = (spell as Item).toObject() as Record<string, unknown>;
		if (ownedNames.has(source.name as string)) continue;
		source._stats = { ...((source._stats as object) ?? {}), compendiumSource: uuid };
		sources.push(source);
	}
	if (!sources.length) return;

	await actor.createEmbeddedDocuments('Item', sources as never);
	await settle();
}

/** What the system still says is missing; empty means the character is complete. */
export async function missingSelections(actor: CharacterActor): Promise<MissingSelection[]> {
	return actor.getMissingLevelSelections();
}
