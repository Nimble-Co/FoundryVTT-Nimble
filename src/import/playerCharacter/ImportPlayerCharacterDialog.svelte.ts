/**
 * Dialog controller for importing a player character from an exported JSON file.
 *
 * Presents a file picker, parses the selected JSON, shows a preview of the
 * character (name, headline details, and the items that will be imported), and
 * only creates the actor once the user confirms.
 */

import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import ImportPlayerCharacterDialogComponent from '#view/dialogs/ImportPlayerCharacterDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

interface ParsedActorItem {
	name?: string;
	type?: string;
	img?: string;
	system?: Record<string, unknown>;
}

interface ImportPreviewItem {
	name: string;
	level: number | null;
}

interface ParsedActor {
	name?: string;
	type?: string;
	img?: string;
	system?: Record<string, unknown>;
	items?: ParsedActorItem[];
}

interface ImportPreviewGroup {
	type: string;
	label: string;
	items: ImportPreviewItem[];
}

interface ImportPreview {
	name: string;
	img: string | null;
	typeLabel: string;
	level: number | null;
	hpMax: number | null;
	ancestry: string | null;
	className: string | null;
	itemGroups: ImportPreviewGroup[];
	totalItems: number;
}

/** Display order for grouped item types in the preview. */
const ITEM_TYPE_ORDER = [
	'ancestry',
	'background',
	'class',
	'subclass',
	'feature',
	'spell',
	'object',
	'boon',
	'monsterFeature',
];

export default class ImportPlayerCharacterDialog extends SvelteApplicationMixin(ApplicationV2) {
	protected root;

	protected props: { dialog: ImportPlayerCharacterDialog };

	declare data: { folder?: string | null; parent?: unknown; pack?: unknown };

	private _parsedData: ParsedActor | null = $state(null);

	private _fileName: string | null = $state(null);

	private _error: string | null = $state(null);

	private _isImporting = $state(false);

	constructor(data: { folder?: string | null; parent?: unknown; pack?: unknown } = {}, _options = {}) {
		const width = 480;
		super({
			position: {
				width,
				height: 'auto' as const,
				top: Math.round(window.innerHeight * 0.1),
				left: Math.round((window.innerWidth - width) / 2),
			},
		});

		this.root = ImportPlayerCharacterDialogComponent;
		this.props = { dialog: this };
		this.data = data;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog'],
		window: {
			icon: 'fa-solid fa-file-import',
			title: 'NIMBLE.actorImport.json.dialogTitle',
			resizable: true,
		},
		position: {
			width: 480,
			height: 'auto' as const,
		},
	};

	protected override async _prepareContext(
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	) {
		return {
			dialog: this,
		} as foundry.applications.api.ApplicationV2.RenderContext;
	}

	get fileName(): string | null {
		return this._fileName;
	}

	get error(): string | null {
		return this._error;
	}

	get isImporting(): boolean {
		return this._isImporting;
	}

	get hasFile(): boolean {
		return this._parsedData !== null;
	}

	/** Structured, localized summary of the character that would be imported. */
	get preview(): ImportPreview | null {
		const data = this._parsedData;
		if (!data) return null;

		const items = Array.isArray(data.items) ? data.items : [];

		const groups = new Map<string, ImportPreviewItem[]>();
		for (const item of items) {
			const type = item?.type ?? 'base';
			if (!groups.has(type)) groups.set(type, []);
			groups.get(type)!.push({
				name: item?.name ?? '—',
				level: ImportPlayerCharacterDialog.#itemLevel(item),
			});
		}

		const itemGroups: ImportPreviewGroup[] = [...groups.entries()]
			.sort(([a], [b]) => {
				const indexA = ITEM_TYPE_ORDER.indexOf(a);
				const indexB = ITEM_TYPE_ORDER.indexOf(b);
				return (indexA < 0 ? 99 : indexA) - (indexB < 0 ? 99 : indexB);
			})
			.map(([type, groupItems]) => ({
				type,
				label: game.i18n.localize(`TYPES.Item.${type}`),
				items: groupItems,
			}));

		const findName = (type: string) => items.find((item) => item?.type === type)?.name ?? null;

		const classData = data.system?.classData as { levels?: unknown } | undefined;
		const levels = classData?.levels;

		return {
			name: data.name?.trim() || game.i18n.localize('NIMBLE.actorImport.json.unnamed'),
			img: data.img ?? null,
			typeLabel: game.i18n.localize(`TYPES.Actor.${data.type ?? 'character'}`),
			level: Array.isArray(levels) ? levels.length : null,
			hpMax: ImportPlayerCharacterDialog.#deriveMaxHp(data, items),
			ancestry: findName('ancestry'),
			className: findName('class'),
			itemGroups,
			totalItems: items.length,
		};
	}

	/** The class level at which a feature item was gained, if recorded. */
	static #itemLevel(item: ParsedActorItem | undefined): number | null {
		const system = item?.system as { gainedAtLevel?: unknown } | undefined;
		const level = system?.gainedAtLevel;
		return typeof level === 'number' && level > 0 ? level : null;
	}

	/**
	 * Compute the character's derived max HP from class hit-die data.
	 *
	 * Mirrors the runtime derivation (see `character.ts#_prepareHitPoints` and
	 * `class.ts`): `hp.max` is never stored, so reading it from the export yields
	 * 0. Each class contributes `startingHpByHitDieSize[size] + sum(hpData)`, plus
	 * the actor's flat `hp.bonus`.
	 */
	static #deriveMaxHp(data: ParsedActor, items: ParsedActorItem[]): number | null {
		const classItems = items.filter((item) => item?.type === 'class');
		if (classItems.length === 0) return null;

		const startingByDie =
			(CONFIG.NIMBLE as { startingHpByHitDieSize?: Record<number, number> })
				.startingHpByHitDieSize ?? {};
		const attributes = data.system?.attributes as { hp?: { bonus?: number } } | undefined;
		const bonus = attributes?.hp?.bonus ?? 0;

		return classItems.reduce((total, item) => {
			const system = (item.system ?? {}) as { hitDieSize?: number; hpData?: number[] };
			const starting =
				system.hitDieSize !== undefined ? (startingByDie[system.hitDieSize] ?? 0) : 0;
			const fromLevels = Array.isArray(system.hpData)
				? system.hpData.reduce((acc, value) => acc + (value || 0), 0)
				: 0;
			return total + starting + fromLevels;
		}, bonus);
	}

	/** Read and parse a selected file, populating the preview or an error. */
	async loadFile(file: File | null | undefined): Promise<void> {
		this._error = null;
		this._parsedData = null;
		this._fileName = file?.name ?? null;

		if (!file) return;

		try {
			const text = await file.text();
			const data = JSON.parse(text) as ParsedActor;

			if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
				throw new Error('Not a valid actor export');
			}

			this._parsedData = data;
		} catch (error) {
			console.error('Player character import: failed to parse JSON', error);
			this._error = game.i18n.localize('NIMBLE.actorImport.json.parseError');
		}
	}

	/** Clear the current selection so the user can pick a different file. */
	clearFile(): void {
		this._parsedData = null;
		this._fileName = null;
		this._error = null;
	}

	/** Create the actor from the parsed data and close the dialog. */
	async confirmImport(): Promise<void> {
		if (!this._parsedData || this._isImporting) return;

		this._isImporting = true;

		try {
			const data = { ...(this._parsedData as Record<string, unknown>) };

			// Drop the source id so Foundry generates a fresh one for this world.
			delete data._id;

			const { documentClasses } = CONFIG.NIMBLE.Actor;
			const actorType = (data.type as string | undefined) ?? 'character';
			const documentClass =
				(documentClasses as Record<string, typeof Actor>)[actorType] ??
				(documentClasses as Record<string, typeof Actor>).character;

			const folder = (this.data.folder as string | null | undefined) ?? null;

			await documentClass.create(
				{ ...data, folder } as object as Actor.CreateData,
				{ parent: this.data.parent, pack: this.data.pack, renderSheet: true } as object,
			);

			ui.notifications?.info(game.i18n.localize('NIMBLE.actorImport.json.success'));
			await this.close();
		} catch (error) {
			console.error('Player character import failed:', error);
			this._error = game.i18n.localize('NIMBLE.actorImport.json.importError');
			this._isImporting = false;
		}
	}
}
