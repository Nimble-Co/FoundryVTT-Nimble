import crypto from 'crypto';
import fs from 'fs';
import { globSync } from 'glob';
import path from 'path';
import systemJSON from '../../public/system.json' with { type: 'json' };
import LevelDatabase from './LevelDB.mjs';

export default class Pack {
	static #PACK_DEST = path.resolve(process.cwd(), 'public/packs');

	static #packsMetadata = systemJSON.packs;

	constructor(dirName, data) {
		const metadata = Pack.#packsMetadata.find(
			(p) => path.basename(p.path).split('.')[0] === path.basename(dirName),
		);

		if (!metadata) throw Error(`[ERROR] - Pack ${dirName} isn't setup in system.json.`);

		/** @type {string} */
		this.systemId = metadata.system;
		/** @type {string} */
		this.packId = metadata.name;
		/** @type {string} */
		this.documentType = metadata.type;

		/** @type {string} */
		this.dirPath = dirName;
		/** @type {string} */
		this.dirName = path.basename(dirName);
		/** @type {Map<string, any>} */
		this.data = data;
		/** @type {any[]} */
		this.folderDocuments = [];
	}

	cleanAndValidate() {
		const folderAssignments = this.#prepareFolderAssignments();

		[...this.data.entries()].map(([file, source]) => {
			this.#cleanDocument(source);

			const folderId = source?._id ? folderAssignments.get(source._id) : null;
			if (folderId) source.folder = folderId;

			fs.writeFileSync(file, JSON.stringify(source, null, '\t'), { encoding: 'utf-8' });

			return source;
		});
	}

	#prepareFolderAssignments() {
		this.folderDocuments = [];

		// Restrict folder generation to the subclasses pack only.
		if (this.dirName !== 'subclasses') return new Map();

		/** @type {any[]} */
		const subclasses = [...this.data.values()].filter(
			(source) => source?.type === 'subclass' && typeof source?.system?.parentClass === 'string',
		);
		if (subclasses.length === 0) return new Map();

		const statsTemplate = this.#getFolderStatsTemplate(subclasses);
		const classIds = [
			...new Set(
				subclasses.map((source) => source.system.parentClass.trim().toLowerCase()).filter(Boolean),
			),
		].sort((a, b) => this.#toDisplayClassName(a).localeCompare(this.#toDisplayClassName(b)));

		const foldersByClass = classIds.reduce((acc, classId, index) => {
			const folder = {
				_id: this.#getStableFolderId(classId),
				_stats: { ...statsTemplate },
				color: null,
				description: '',
				flags: {},
				folder: null,
				name: this.#toDisplayClassName(classId),
				sort: index * 10,
				sorting: 'a',
				type: this.documentType,
			};

			acc.set(classId, folder);
			return acc;
		}, new Map());

		this.folderDocuments = [...foldersByClass.values()];

		return subclasses.reduce((acc, source) => {
			const classId = source.system.parentClass.trim().toLowerCase();
			const folder = foldersByClass.get(classId);
			if (folder && source._id) acc.set(source._id, folder._id);
			return acc;
		}, new Map());
	}

	#getFolderStatsTemplate(sources) {
		const sourceStats = sources.find((source) => source?._stats)?._stats;
		const now = Date.now();

		return {
			coreVersion:
				sourceStats?.coreVersion ??
				String(systemJSON.compatibility.verified ?? systemJSON.compatibility.minimum),
			systemId: sourceStats?.systemId ?? systemJSON.id,
			systemVersion: sourceStats?.systemVersion ?? systemJSON.version,
			createdTime: sourceStats?.createdTime ?? now,
			modifiedTime: sourceStats?.modifiedTime ?? now,
			lastModifiedBy: sourceStats?.lastModifiedBy ?? 'system',
		};
	}

	#toDisplayClassName(classId) {
		if (classId === 'the-cheat') return 'The Cheat';

		return classId
			.replace(/[-_]+/g, ' ')
			.split(' ')
			.filter(Boolean)
			.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
			.join(' ');
	}

	#getStableFolderId(classId) {
		return crypto
			.createHash('sha1')
			.update(`nimble-subclasses-folder:${classId}`)
			.digest('hex')
			.slice(0, 16);
	}

	#cleanDocument(source) {
		// Clean Flags
		if (!source.flags) source.flags = {};
		delete source.flags?.exportSource;
		delete source.flags?.importSource;

		Object.entries(source.flags).forEach(([flagId, flag]) => {
			if (!['core', 'nimble'].includes(flagId)) delete source.flags[flagId];

			if (Object.keys(flag).length === 0) delete source.flags[flag];
		});

		// Empty document folder data
		source.folder = null;

		// Reset ownership data
		if (source.ownership) delete source.ownership;

		// Update _stats data
		// const stats = {
		//   coreVersion: systemJSON.compatibility.minimum,
		//   systemId: systemJSON.id,
		//   systemVersion: systemJSON.version
		// };
		// source._stats = stats;

		// TODO: Update migration data

		// Recurse for sub documents
		if (Array.isArray(source?.effects)) source.effects.forEach((e) => this.#cleanDocument(e));
		if (Array.isArray(source?.items)) source.items.forEach((i) => this.#cleanDocument(i));
	}

	async saveAsPack() {
		if (!fs.lstatSync(Pack.#PACK_DEST, { throwIfNoEntry: false })?.isDirectory()) {
			fs.mkdirSync(Pack.#PACK_DEST);
		}

		const outDir = path.join(Pack.#PACK_DEST, this.dirName);
		if (fs.lstatSync(outDir, { throwIfNoEntry: false })?.isDirectory()) {
			fs.rmSync(outDir, { recursive: true });
		}

		this.cleanAndValidate();

		const db = new LevelDatabase(outDir, { packName: this.dirName });
		await db.createPack([...this.data.values()], { folders: this.folderDocuments });
		const count = this.data.size;

		console.log(`[INFO] - Pack "${this.packId}" with ${count} documents built successfully.`);

		return count;
	}

	saveAsJSON() {}

	static loadJSONFiles(dirPath) {
		const filenames = globSync(`${dirPath}/**/*.json`);
		const files = new Map();

		for (const file of filenames) {
			let jsonData;

			try {
				jsonData = JSON.parse(fs.readFileSync(file, { encoding: 'utf-8' }).toString());
			} catch (err) {
				console.error(err);
				console.warn(`[ERROR] - ${file} failed to parse.`);
				continue;
			}

			if (!jsonData) continue;

			files.set(file, jsonData);
		}

		return new Pack(dirPath, files);
	}
}
