import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import FeatureSheetComponent from '../../view/sheets/FeatureSheet.svelte';

export default class FeatureSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = FeatureSheetComponent;

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
			width: 400,
			height: 'auto',
		},
		actions: {},
	};

	protected async _prepareContext() {
		return {
			item: this.item,
			sheet: this,
		};
	}
}
