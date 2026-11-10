import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import EffectSheetComponent from '../../view/sheets/EffectSheet.svelte';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

type DocumentSheet = foundry.applications.api.DocumentSheetV2.Any;

// fvtt-types types DocumentSheetV2 with type arguments that the mixin cannot pass.
const DocumentSheetBase = foundry.applications.api.DocumentSheetV2 as unknown as abstract new (
	// biome-ignore lint/suspicious/noExplicitAny: a mixin base takes any arguments (TS2545)
	...args: any[]
) => DocumentSheet;

/** The window of a Nimble Active Effect: Details, Lasts Until, Changes and Rules. */
export default class EffectSheet extends SvelteApplicationMixin(DocumentSheetBase) {
	protected root;

	constructor(options = {} as SvelteApplicationRenderContext) {
		super(options);

		this.root = EffectSheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-window'],
		window: {
			icon: 'fa-solid fa-person-rays',
			resizable: true,
		},
		position: SHEET_DEFAULTS.effect,
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<DocumentSheet['_prepareContext']>[0],
	): ReturnType<DocumentSheet['_prepareContext']> {
		return {
			effect: (this as unknown as { document: ActiveEffect }).document,
			sheet: this,
		} as object as ReturnType<DocumentSheet['_prepareContext']> extends Promise<infer T>
			? T
			: never;
	}
}
