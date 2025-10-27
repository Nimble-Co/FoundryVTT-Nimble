import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import { SvelteItemSheet } from '#lib/SvelteItemSheet.svelte.js';

import BackgroundSheetComponent from '../../view/sheets/BackgroundSheet.svelte';

export default class BackgroundSheet extends SvelteApplicationMixin(SvelteItemSheet) {
	protected root;

	constructor(item, options = {} as any) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = BackgroundSheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-building-columns',
			resizable: true,
		},
		position: {
			width: 288,
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

	async toggleBackgroundCategoryOption(selectedCategory: string): Promise<void> {
		await this.document.update({ 'system.category': selectedCategory });
	}
}
