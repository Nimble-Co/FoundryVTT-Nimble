import crypto from 'crypto';
import fs from 'fs';
import { globSync } from 'glob';
import path from 'path';
import systemJSON from '../../public/system.json' with { type: 'json' };
import LevelDatabase from './LevelDB.mjs';

const MINOR_BOON_TYPE = 'minor';
const MAJOR_BOON_TYPE = 'major';
const EPIC_BOON_TYPE = 'epic';
const LODGING_BOON_TYPE = 'lodging';

const CONFIGURED_BOON_TYPES = [MINOR_BOON_TYPE, MAJOR_BOON_TYPE, EPIC_BOON_TYPE, LODGING_BOON_TYPE];

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

		// Monsters are grouped by source path folder names.
		if (this.dirName === 'monsters' && this.documentType === 'Actor') {
			return this.#prepareMonsterFolderAssignments();
		}

		// Boons are grouped by boonType (minor, major, epic).
		if (this.dirName === 'boons' && this.documentType === 'Item') {
			return this.#prepareBoonFolderAssignments();
		}

		// Restrict class-based folder generation to the subclasses pack only.
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

	#prepareMonsterFolderAssignments() {
		const monsters = [...this.data.entries()].filter(
			([, source]) => typeof source?._id === 'string',
		);
		if (monsters.length === 0) return new Map();

		const folderLabelByKey = new Map();
		const folderKeyByActorId = new Map();

		for (const [file, source] of monsters) {
			const folderKey = this.#getMonsterFolderKey(file);
			if (!folderKey) continue;

			folderKeyByActorId.set(source._id, folderKey);
			if (!folderLabelByKey.has(folderKey)) {
				folderLabelByKey.set(folderKey, this.#toDisplayMonsterFolderName(folderKey));
			}
		}

		if (folderLabelByKey.size === 0) return new Map();

		const statsTemplate = this.#getFolderStatsTemplate(monsters.map(([, source]) => source));
		const foldersByKey = [...folderLabelByKey.entries()]
			.sort((a, b) => a[1].localeCompare(b[1]))
			.reduce((acc, [folderKey, folderName], index) => {
				const folder = {
					_id: this.#getMonsterFolderId(folderKey),
					_stats: { ...statsTemplate },
					color: null,
					description: '',
					flags: {},
					folder: null,
					name: folderName,
					sort: index * 10,
					sorting: 'a',
					type: this.documentType,
				};

				acc.set(folderKey, folder);
				return acc;
			}, new Map());

		this.folderDocuments = [...foldersByKey.values()];

		return [...folderKeyByActorId.entries()].reduce((acc, [actorId, folderKey]) => {
			const folder = foldersByKey.get(folderKey);
			if (folder) acc.set(actorId, folder._id);
			return acc;
		}, new Map());
	}

	#prepareBoonFolderAssignments() {
		/** @type {any[]} */
		const boons = [...this.data.values()].filter(
			(source) => typeof source?._id === 'string' && typeof source?.system?.boonType === 'string',
		);
		if (boons.length === 0) return new Map();

		const statsTemplate = this.#getFolderStatsTemplate(boons);
		const boonTypes = [
			...new Set(
				boons.map((source) => source.system.boonType.trim().toLowerCase()).filter(Boolean),
			),
		].sort((a, b) => {
			const aIndex = CONFIGURED_BOON_TYPES.indexOf(a);
			const bIndex = CONFIGURED_BOON_TYPES.indexOf(b);
			if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
			if (aIndex !== -1) return -1;
			if (bIndex !== -1) return 1;
			return this.#toDisplayBoonFolderName(a).localeCompare(this.#toDisplayBoonFolderName(b));
		});

		const foldersByType = boonTypes.reduce((acc, boonType, index) => {
			const folder = {
				_id: this.#getBoonFolderId(boonType),
				_stats: { ...statsTemplate },
				color: null,
				description: '',
				flags: {},
				folder: null,
				name: this.#toDisplayBoonFolderName(boonType),
				sort: index * 10,
				// Lodging uses explicit `sort` values so we can preserve a fixed custom display order.
				sorting: boonType === LODGING_BOON_TYPE ? 'm' : 'a',
				type: this.documentType,
			};

			acc.set(boonType, folder);
			return acc;
		}, new Map());

		this.folderDocuments = [...foldersByType.values()];

		return boons.reduce((acc, source) => {
			const boonType = source.system.boonType.trim().toLowerCase();
			const folder = foldersByType.get(boonType);
			if (boonType === LODGING_BOON_TYPE) {
				const sortOrder = this.#getLodgingBoonSortOrder(source.name);
				if (sortOrder !== null) source.sort = sortOrder;
			}
			if (folder) acc.set(source._id, folder._id);
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

	#getMonsterFolderKey(filePath) {
		const relativePath = path.relative(this.dirPath, filePath);
		const directory = path.dirname(relativePath);
		if (!directory || directory === '.') return null;

		const segments = directory.split(path.sep).filter(Boolean);
		if (!segments.length) return null;

		if (segments[0] === 'core') return segments[1] ?? null;
		return segments[0];
	}

	#toDisplayMonsterFolderName(folderKey) {
		return folderKey
			.split(/[-_]+/g)
			.filter(Boolean)
			.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
			.join(' ');
	}

	#getMonsterFolderId(folderKey) {
		return crypto
			.createHash('sha1')
			.update(`${this.packId}-folder:${folderKey}`)
			.digest('hex')
			.slice(0, 16);
	}

	#toDisplayBoonFolderName(boonType) {
		switch (boonType) {
			case MINOR_BOON_TYPE:
				return 'Minor Boons';
			case MAJOR_BOON_TYPE:
				return 'Major Boons';
			case EPIC_BOON_TYPE:
				return 'Epic Boons';
			default:
				return `${boonType
					.replace(/[-_]+/g, ' ')
					.split(' ')
					.filter(Boolean)
					.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
					.join(' ')} Boons`;
		}
	}

	#getLodgingBoonSortOrder(boonName) {
		if (typeof boonName !== 'string') return null;

		const order = [
			'lodging boons',
			'recover 2 additional wounds',
			'gain lvl temp hp',
			'gain key temp hit dice',
			'+1 speed',
			'inspired (reroll any die, once)',
			'advantage vs. fear/charm/etc.',
			'learn an important rumor',
			'+key mana',
		];

		const index = order.indexOf(boonName.trim().toLowerCase());
		return index === -1 ? null : index * 10;
	}

	#getBoonFolderId(boonType) {
		return crypto
			.createHash('sha1')
			.update(`${this.packId}-boon-folder:${boonType}`)
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
