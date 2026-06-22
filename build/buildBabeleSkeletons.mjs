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
 * Usage:
 *   node build/buildBabeleSkeletons.mjs           # refresh all configured languages
 *   node build/buildBabeleSkeletons.mjs es fr     # refresh specific languages
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { globSync } from 'glob';
import systemJSON from '../public/system.json' with { type: 'json' };

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(dirName, '..');
const packsRoot = path.resolve(projectRoot, 'packs');
const babeleRoot = path.resolve(projectRoot, 'public/lang/babele');

const SYSTEM_ID = systemJSON.id;
const ACTOR_TYPES = new Set(['character', 'minion', 'npc', 'soloMonster']);

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
				return JSON.parse(fs.readFileSync(file, 'utf8'));
			} catch (err) {
				console.warn(`[WARN] - failed to parse ${file}: ${err.message}`);
				return null;
			}
		})
		.filter(Boolean);
}

function extractEntryFields(source) {
	const fields = {};
	if (typeof source.name === 'string') fields.name = source.name;

	const description = source.system?.description;
	if (typeof description === 'string' && description.trim()) fields.description = description;

	if (ACTOR_TYPES.has(source.type)) {
		const creatureType = source.system?.details?.creatureType;
		if (typeof creatureType === 'string' && creatureType.trim()) fields.creatureType = creatureType;
	}
	return fields;
}

function buildEmbeddedItemEntries(actorSource) {
	if (!Array.isArray(actorSource.items)) return null;
	const entries = {};
	for (const item of actorSource.items) {
		if (!item?.name) continue;
		const fields = extractEntryFields(item);
		if (Object.keys(fields).length === 0) continue;
		entries[item.name] = fields;
	}
	return Object.keys(entries).length > 0 ? entries : null;
}

function mergeEntry(existing, source) {
	const merged = {};
	for (const [key, sourceValue] of Object.entries(source)) {
		const existingValue = existing?.[key];
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

function reconcileEntries(existingEntries, sourceEntries) {
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

function buildPackSkeleton(packMeta, sources, existing) {
	const sourceEntries = {};
	for (const source of sources) {
		if (!source?.name) continue;
		const fields = extractEntryFields(source);
		if (Object.keys(fields).length === 0) continue;

		const isActor = ACTOR_TYPES.has(source.type);
		if (isActor) {
			const embedded = buildEmbeddedItemEntries(source);
			if (embedded) fields.items = embedded;
		}
		sourceEntries[source.name] = fields;
	}

	const reconciled = reconcileEntries(existing?.entries, sourceEntries);

	const skeleton = {
		label: existing?.label ?? packMeta.label,
		entries: reconciled.merged,
	};
	if (existing?.folders) skeleton.folders = existing.folders;
	if (existing?.mapping) skeleton.mapping = existing.mapping;

	return { skeleton, added: reconciled.added, stale: reconciled.stale };
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

		const { skeleton, added, stale } = buildPackSkeleton(meta, sources, existing);
		writePretty(filePath, skeleton);

		touched += 1;
		addedCount += added.length;
		staleCount += stale.length;

		if (added.length > 0) console.log(`[INFO] - ${lang}/${fileName}: +${added.length} new entries`);
		if (stale.length > 0)
			console.log(
				`[WARN] - ${lang}/${fileName}: ${stale.length} entries no longer present in source — kept for manual review`,
			);
	}

	return { touched, addedCount, staleCount };
}

console.log('[INFO] - Building Babele translation skeletons.');
const packMetaMap = packMetaByDirName();
const languages = getDeclaredLanguages();

for (const lang of languages) {
	const summary = buildAllForLanguage(lang, packMetaMap);
	console.log(
		`[INFO] - ${lang}: ${summary.touched} files updated (${summary.addedCount} new, ${summary.staleCount} stale)`,
	);
}

console.log('[INFO] - Babele skeleton build complete.');
