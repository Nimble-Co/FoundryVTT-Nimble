import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import AncestrySheetComponent from '../../view/sheets/AncestrySheet.svelte';

export default class AncestrySheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = AncestrySheetComponent;

		this.props = {
			item: this.document,
			sheet: this,
		};
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: {
			width: 288,
			height: 'auto',
		},
	};

	protected async _prepareContext() {
		return {
			item: this.item,
			sheet: this,
		};
	}
}
