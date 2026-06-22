#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Regenerates Babele translation skeleton files from the English pack sources.
 *
 * For each language under `public/lang/babele/<lang>/`, writes one file per
 * compendium (named `<system-id>.<pack-name>.json` to match Babele's lookup
 * convention) populated with English source values as placeholders. Existing
 * translated values are preserved — only new keys are added and stale keys
 * are reported but kept (so translators can recover them on rename).
 *
 * Fields extracted:
 *   - top-level `name`
 *   - `system.description`
 *   - `system.details.creatureType` (actors)
 *   - `prototypeToken.name` (actors)
 *   - `system.activation.cost.details`, `duration.details`, `targets.restrictions` (items)
 *   - `system.rules[]` → map keyed by `rule.id`, capturing `label`
 *   - For roll tables: `results[]` → map keyed by `_id`, capturing `name` + `description`
 *   - Embedded actor items, recursively (keyed by `name` per Babele convention)
 *   - Folder labels per pack (monsters by directory, boons/subclasses/classFeatures
 *     by Pack.mjs derivation logic)
 *
 * Slug-like fields (`system.class`, `system.subclass`, `system.parentClass`,
 * `system.group`, `system.boonType`) are intentionally NOT extracted as entry
 * fields — Pack.mjs lowercases them to derive folder ids, so translating the
 * field would break folder generation. Translate the folder label instead.
 *
 * Usage:
 *   node build/buildBabeleSkeletons.mjs           # refresh all configured languages
 *   node build/buildBabeleSkeletons.mjs es fr     # refresh specific languages
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { globSync } from 'glob';
import systemJSON from '../public/system.json' with { type: 'json' };
import {
	ACTOR_TYPES,
	buildEmbeddedItemEntries,
	buildTableResultEntries,
	extractEntryFields,
	nonEmptyString,
	reconcileEntries,
	sortObjectKeys,
	toTitleCase,
} from './lib/babeleSkeletonsLib.mjs';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(dirName, '..');
const packsRoot = path.resolve(projectRoot, 'packs');
const babeleRoot = path.resolve(projectRoot, 'public/lang/babele');

const SYSTEM_ID = systemJSON.id;

function getDeclaredLanguages() {
	const cliLangs = process.argv.slice(2).filter(Boolean);
	if (cliLangs.length > 0) return cliLangs;
	if (fs.existsSync(babeleRoot)) {
		const dirs = fs
			.readdirSync(babeleRoot, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
		if (dirs.length > 0) return dirs;
	}
	return ['es', 'fr'];
}

function packMetaByDirName() {
	return systemJSON.packs.reduce((acc, pack) => {
		const dir = path.basename(pack.path).split('.')[0];
		acc.set(dir, pack);
		return acc;
	}, new Map());
}

function listSourcePackDirs() {
	return fs
		.readdirSync(packsRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => path.join(packsRoot, d.name));
}

function loadPackSources(dirPath) {
	const files = globSync(`${dirPath.replace(/\\/g, '/')}/**/*.json`);
	return files
		.map((file) => {
			try {
				return { file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
			} catch (err) {
				console.warn(`[WARN] - failed to parse ${file}: ${err.message}`);
				return null;
			}
		})
		.filter(Boolean);
}

function deriveMonsterFolders(packDir, sources) {
	const folders = new Set();
	for (const { file } of sources) {
		const relative = path.relative(packDir, file);
		const segments = path.dirname(relative).split(path.sep).filter(Boolean);
		if (segments.length === 0) continue;
		const key = segments[0] === 'core' ? segments[1] : segments[0];
		if (!key) continue;
		folders.add(toTitleCase(key));
	}
	return [...folders];
}

function deriveBoonFolders(sources) {
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

function deriveSubclassFolders(sources) {
	const parents = new Set();
	for (const { data } of sources) {
		if (nonEmptyString(data?.system?.parentClass))
			parents.add(toTitleCase(data.system.parentClass.trim().toLowerCase()));
	}
	return [...parents];
}

function deriveClassFeatureFolders(packDir, sources) {
	const classes = new Map(); // classId → { name, subclasses: Set, groups: Map(slug→label) }

	function classDataFor(classId) {
		if (!classes.has(classId)) {
			classes.set(classId, {
				name: toTitleCase(classId === 'the-cheat' ? 'The Cheat' : classId),
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

function deriveFoldersForPack(dirBaseName, packDir, sources) {
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

function buildPackSkeleton(packMeta, dirBaseName, packDir, sources, existing) {
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

function readExisting(filePath) {
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (err) {
		console.warn(
			`[WARN] - existing translation file ${filePath} could not be parsed: ${err.message}`,
		);
		return null;
	}
}

function writePretty(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');
}

function buildAllForLanguage(lang, packMetaMap) {
	const langDir = path.join(babeleRoot, lang);
	const sourcePackDirs = listSourcePackDirs();

	let touched = 0;
	let addedCount = 0;
	let staleCount = 0;
	let foldersAddedCount = 0;
	let collisionCount = 0;

	for (const packDir of sourcePackDirs) {
		const dirBaseName = path.basename(packDir);
		const meta = packMetaMap.get(dirBaseName);
		if (!meta) {
			console.warn(`[WARN] - skipping ${dirBaseName}: no matching pack entry in system.json`);
			continue;
		}

		const sources = loadPackSources(packDir);
		if (sources.length === 0) continue;

		const fileName = `${SYSTEM_ID}.${meta.name}.json`;
		const filePath = path.join(langDir, fileName);
		const existing = readExisting(filePath);

		const { skeleton, added, stale, foldersAdded, collisions } = buildPackSkeleton(
			meta,
			dirBaseName,
			packDir,
			sources,
			existing,
		);
		writePretty(filePath, skeleton);

		touched += 1;
		addedCount += added.length;
		staleCount += stale.length;
		foldersAddedCount += foldersAdded;
		collisionCount += collisions.length;

		const parts = [];
		if (added.length > 0) parts.push(`+${added.length} entries`);
		if (foldersAdded > 0) parts.push(`+${foldersAdded} folders`);
		if (parts.length > 0) console.log(`[INFO] - ${lang}/${fileName}: ${parts.join(', ')}`);
		if (stale.length > 0)
			console.log(
				`[WARN] - ${lang}/${fileName}: ${stale.length} entries no longer present in source — kept for manual review`,
			);
		if (collisions.length > 0)
			console.log(
				`[WARN] - ${lang}/${fileName}: embedded item name collisions — second occurrence overwrites first:\n    ${collisions.join('\n    ')}`,
			);
	}

	return { touched, addedCount, staleCount, foldersAddedCount, collisionCount };
}

console.log('[INFO] - Building Babele translation skeletons.');
const packMetaMap = packMetaByDirName();
const languages = getDeclaredLanguages();

for (const lang of languages) {
	const summary = buildAllForLanguage(lang, packMetaMap);
	console.log(
		`[INFO] - ${lang}: ${summary.touched} files updated (${summary.addedCount} new entries, ${summary.foldersAddedCount} new folders, ${summary.staleCount} stale, ${summary.collisionCount} embedded-name collisions)`,
	);
}

console.log('[INFO] - Babele skeleton build complete.');
