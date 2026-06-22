/**
 * Pure helpers for building Babele translation skeletons.
 *
 * Extracted from `build/buildBabeleSkeletons.mjs` so they can be unit-tested
 * without touching the filesystem.
 */
import path from 'node:path';

export const ACTOR_TYPES = new Set(['character', 'minion', 'npc', 'soloMonster']);

export function nonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

export function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function toTitleCase(slug) {
	return slug
		.replace(/[-_]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

export function extractRuleEntries(rules) {
	if (!Array.isArray(rules)) return null;
	const entries = {};
	rules.forEach((rule, index) => {
		if (!nonEmptyString(rule?.label)) return;
		const key = nonEmptyString(rule.id) ? rule.id : `index:${index}`;
		entries[key] = { label: rule.label };
	});
	return Object.keys(entries).length > 0 ? entries : null;
}

export function extractActivationFields(activation) {
	if (!activation || typeof activation !== 'object') return null;
	const out = {};
	if (nonEmptyString(activation.cost?.details)) out.costDetails = activation.cost.details;
	if (nonEmptyString(activation.duration?.details))
		out.durationDetails = activation.duration.details;
	if (nonEmptyString(activation.targets?.restrictions))
		out.targetsRestrictions = activation.targets.restrictions;
	return Object.keys(out).length > 0 ? out : null;
}

export function extractEntryFields(source, { isRollTable = false } = {}) {
	const fields = {};
	if (nonEmptyString(source.name)) fields.name = source.name;

	// RollTables store description at top-level; actors and items use system.description.
	const description = isRollTable ? source.description : source.system?.description;
	if (nonEmptyString(description)) fields.description = description;

	if (ACTOR_TYPES.has(source.type)) {
		const creatureType = source.system?.details?.creatureType;
		if (nonEmptyString(creatureType)) fields.creatureType = creatureType;

		const tokenName = source.prototypeToken?.name;
		if (nonEmptyString(tokenName) && tokenName !== source.name) fields.tokenName = tokenName;
	}

	const activation = extractActivationFields(source.system?.activation);
	if (activation) Object.assign(fields, activation);

	const rules = extractRuleEntries(source.system?.rules);
	if (rules) fields.rules = rules;

	return fields;
}

/**
 * Walks `actorSource.items` and returns a name-keyed entry map (Babele's
 * convention for `cardinality: many` embedded translations). When two items
 * share a `name`, the second silently overwrites the first; callers can pass
 * a `collisions` array to capture those names for reporting.
 */
export function buildEmbeddedItemEntries(actorSource, collisions) {
	if (!Array.isArray(actorSource.items)) return null;
	const entries = {};
	for (const item of actorSource.items) {
		if (!nonEmptyString(item?.name)) continue;
		const fields = extractEntryFields(item);
		if (Object.keys(fields).length === 0) continue;
		if (item.name in entries && Array.isArray(collisions)) {
			collisions.push(`${actorSource.name ?? '<unknown>'} → ${item.name}`);
		}
		entries[item.name] = fields;
	}
	return Object.keys(entries).length > 0 ? entries : null;
}

export function buildTableResultEntries(tableSource) {
	if (!Array.isArray(tableSource.results)) return null;
	const entries = {};
	for (const result of tableSource.results) {
		if (!nonEmptyString(result?._id)) continue;
		const fields = {};
		if (nonEmptyString(result.name)) fields.name = result.name;
		if (nonEmptyString(result.description)) fields.description = result.description;
		if (Object.keys(fields).length === 0) continue;
		entries[result._id] = fields;
	}
	return Object.keys(entries).length > 0 ? entries : null;
}

/**
 * Recursively merge `source` over `existing`, preserving translator edits
 * while folding in newly-extracted source fields.
 *
 * Notes:
 *   - Empty string in `existing` is treated as "not yet translated" and falls
 *     through to the source placeholder.
 *   - When `existing` and `source` disagree on shape (object vs primitive),
 *     the existing translation no longer fits the source schema, so we fall
 *     back to `source` rather than carry a stale value forward.
 */
export function mergeEntry(existing, source) {
	const merged = {};
	for (const [key, sourceValue] of Object.entries(source)) {
		const existingValue = existing?.[key];
		const existingIsObject = isPlainObject(existingValue);
		const sourceIsObject = isPlainObject(sourceValue);

		if (existingIsObject && sourceIsObject) {
			merged[key] = mergeEntry(existingValue, sourceValue);
			continue;
		}

		if (existingIsObject !== sourceIsObject) {
			merged[key] = sourceValue;
			continue;
		}

		if (existingValue !== undefined && existingValue !== sourceValue && existingValue !== '') {
			merged[key] = existingValue;
		} else {
			merged[key] = sourceValue;
		}
	}
	for (const [key, value] of Object.entries(existing ?? {})) {
		if (!(key in merged)) merged[key] = value;
	}
	return merged;
}

export function reconcileEntries(existingEntries, sourceEntries) {
	const merged = {};
	const added = [];
	const stale = [];

	for (const [name, sourceFields] of Object.entries(sourceEntries)) {
		const prior = existingEntries?.[name];
		merged[name] = mergeEntry(prior, sourceFields);
		if (!prior) added.push(name);
	}

	for (const [name, value] of Object.entries(existingEntries ?? {})) {
		if (!(name in merged)) {
			merged[name] = value;
			stale.push(name);
		}
	}

	return { merged, added, stale };
}

/**
 * Recursively sort an object's own keys alphabetically (case-insensitive).
 * Arrays and primitives are returned as-is.
 *
 * Skeleton files are sorted before write so regenerations produce stable diffs
 * regardless of source-pack iteration order on disk.
 */
export function sortObjectKeys(value) {
	if (!isPlainObject(value)) return value;
	const sorted = {};
	for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
		sorted[key] = sortObjectKeys(value[key]);
	}
	return sorted;
}

export function deriveMonsterFolders(packDir, sources) {
	const folders = new Set();
	for (const { file } of sources) {
		const relative = path.relative(packDir, file);
		// `path.dirname` returns "." for files at the pack root — strip it so
		// root-level sources don't produce a literal "." folder.
		const segments = path
			.dirname(relative)
			.split(path.sep)
			.filter((segment) => segment && segment !== '.');
		if (segments.length === 0) continue;
		const key = segments[0] === 'core' ? segments[1] : segments[0];
		if (!key) continue;
		folders.add(toTitleCase(key));
	}
	return [...folders];
}

export function deriveBoonFolders(sources) {
	const types = new Set();
	for (const { data } of sources) {
		if (nonEmptyString(data?.system?.boonType))
			types.add(data.system.boonType.trim().toLowerCase());
	}
	return [...types].map((t) => {
		if (t === 'minor') return 'Minor Boons';
		if (t === 'major') return 'Major Boons';
		if (t === 'epic') return 'Epic Boons';
		return `${toTitleCase(t)} Boons`;
	});
}

export function deriveSubclassFolders(sources) {
	const parents = new Set();
	for (const { data } of sources) {
		if (nonEmptyString(data?.system?.parentClass))
			parents.add(toTitleCase(data.system.parentClass.trim().toLowerCase()));
	}
	return [...parents];
}

export function deriveClassFeatureFolders(packDir, sources) {
	const classes = new Map(); // classId → { name, subclasses: Set, groups: Map(slug→label) }

	function classDataFor(classId) {
		if (!classes.has(classId)) {
			classes.set(classId, {
				name: toTitleCase(classId),
				subclasses: new Set(),
				groups: new Map(),
			});
		}
		return classes.get(classId);
	}

	for (const { file, data } of sources) {
		const relative = path.relative(packDir, file);
		const parts = relative.split(path.sep).filter(Boolean);
		const classId =
			(parts.length >= 2 ? parts[1].toLowerCase() : null) ??
			(nonEmptyString(data?.system?.class) ? data.system.class.toLowerCase() : null);
		if (!classId) continue;

		const cd = classDataFor(classId);

		const subclassMarkerIndex = parts.findIndex((p) => p.endsWith('-subclasses'));
		const pathSubclass = subclassMarkerIndex >= 0 ? parts[subclassMarkerIndex + 1] : null;
		if (pathSubclass) {
			cd.subclasses.add(toTitleCase(pathSubclass));
			continue;
		}
		if (nonEmptyString(data?.system?.subclass)) {
			cd.subclasses.add(data.system.subclass);
			continue;
		}

		const groupSlug = data?.system?.group;
		if (nonEmptyString(groupSlug) && !groupSlug.endsWith('-progression')) {
			const display =
				(nonEmptyString(data?.system?.groupLabel) && data.system.groupLabel) ||
				toTitleCase(groupSlug);
			cd.groups.set(groupSlug, display);
		}
	}

	const folders = new Set();
	for (const cd of classes.values()) {
		folders.add(cd.name);
		folders.add(`${cd.name} Progression`);
		if (cd.subclasses.size > 0) folders.add(`${cd.name} Subclasses`);
		for (const sub of cd.subclasses) folders.add(sub);
		for (const label of cd.groups.values()) folders.add(label);
	}
	return [...folders];
}

export function deriveFoldersForPack(dirBaseName, packDir, sources) {
	switch (dirBaseName) {
		case 'monsters':
		case 'legendaryMonsters':
			return deriveMonsterFolders(packDir, sources);
		case 'boons':
			return deriveBoonFolders(sources);
		case 'subclasses':
			return deriveSubclassFolders(sources);
		case 'classFeatures':
			return deriveClassFeatureFolders(packDir, sources);
		default:
			return [];
	}
}

export function buildPackSkeleton(packMeta, dirBaseName, packDir, sources, existing) {
	const isRollTable = packMeta.type === 'RollTable';
	const sourceEntries = {};
	const collisions = [];

	for (const { data } of sources) {
		if (!nonEmptyString(data?.name)) continue;
		const fields = extractEntryFields(data, { isRollTable });
		if (Object.keys(fields).length === 0) continue;

		if (ACTOR_TYPES.has(data.type)) {
			const embedded = buildEmbeddedItemEntries(data, collisions);
			if (embedded) fields.items = embedded;
		}

		if (isRollTable) {
			const results = buildTableResultEntries(data);
			if (results) fields.results = results;
		}

		sourceEntries[data.name] = fields;
	}

	const reconciled = reconcileEntries(existing?.entries, sourceEntries);

	const folderNames = deriveFoldersForPack(dirBaseName, packDir, sources);
	const folders = { ...(existing?.folders ?? {}) };
	let foldersAdded = 0;
	for (const folder of folderNames) {
		if (!(folder in folders)) {
			folders[folder] = folder;
			foldersAdded += 1;
		}
	}

	// Sort entries/folders alphabetically (recursively) so regenerations produce
	// stable diffs regardless of source-pack iteration order on disk.
	const skeleton = {
		label: existing?.label ?? packMeta.label,
		entries: sortObjectKeys(reconciled.merged),
	};
	if (Object.keys(folders).length > 0) skeleton.folders = sortObjectKeys(folders);
	if (existing?.mapping) skeleton.mapping = existing.mapping;

	return {
		skeleton,
		added: reconciled.added,
		stale: reconciled.stale,
		foldersAdded,
		collisions,
	};
}
