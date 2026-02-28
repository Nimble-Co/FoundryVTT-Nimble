import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import ObjectSheetComponent from '../../view/sheets/ObjectSheet.svelte';
import { SHEET_DEFAULTS } from './sheetDefaults.js';

export default class ObjectSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = ObjectSheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-crown',
			resizable: true,
		},
		position: SHEET_DEFAULTS.item,
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.sheets.ItemSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ItemSheetV2['_prepareContext']> {
		return {
			item: this.item,
			sheet: this,
		} as object as ReturnType<
			foundry.applications.sheets.ItemSheetV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}
}
