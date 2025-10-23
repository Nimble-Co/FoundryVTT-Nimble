import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import SubclassSheetComponent from '../../view/sheets/SubclassSheet.svelte';

export default class SubclassSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = SubclassSheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-user',
<<<<<<< HEAD
			resizable: true,
=======
>>>>>>> d905bfc (Add subclass selection UI and prevent errors from compendium)
		},
		position: {
			width: 288,
			height: 'auto',
		},
		actions: {},
	};

<<<<<<< HEAD
	protected async _prepareContext() {
=======
	protected override async _prepareContext() {
>>>>>>> d905bfc (Add subclass selection UI and prevent errors from compendium)
		return {
			item: this.item,
			sheet: this,
		};
	}
}
