/**
 * Pure helpers for building Babele translation skeletons.
 *
 * Extracted from `build/buildBabeleSkeletons.mjs` so they can be unit-tested
 * without touching the filesystem.
 */

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
