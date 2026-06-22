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
import { buildPackSkeleton } from './lib/babeleSkeletonsLib.mjs';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(dirName, '..');
const packsRoot = path.resolve(projectRoot, 'packs');
const babeleRoot = path.resolve(projectRoot, 'public/lang/babele');

const SYSTEM_ID = systemJSON.id;

function getNonEnglishDeclaredLanguages() {
	return systemJSON.languages
		.map((entry) => entry.lang)
		.filter((lang) => lang && lang !== 'en' && !lang.startsWith('en-'));
}

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
	const declared = getNonEnglishDeclaredLanguages();
	if (declared.length === 0) {
		console.error(
			'[ERROR] - No languages to build. Pass <lang> on the command line, or declare a non-English language in public/system.json and create public/lang/babele/<lang>/.',
		);
		process.exit(1);
	}
	return declared;
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
