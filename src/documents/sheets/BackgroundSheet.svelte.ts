import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import { SvelteItemSheet } from '#lib/SvelteItemSheet.svelte.js';

import BackgroundSheetComponent from '../../view/sheets/BackgroundSheet.svelte';

export default class BackgroundSheet extends SvelteApplicationMixin(SvelteItemSheet) {
	protected root;

	constructor(item, options = {}) {
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
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<SvelteItemSheet['_prepareContext']>[0],
	): ReturnType<SvelteItemSheet['_prepareContext']> {
		return {
			item: this.item,
			sheet: this,
		} as object as Awaited<ReturnType<SvelteItemSheet['_prepareContext']>>;
	}

	async toggleBackgroundCategoryOption(selectedCategory: string): Promise<void> {
		await (
			this.document as object as { update(data: Record<string, unknown>): Promise<void> }
		).update({ 'system.category': selectedCategory });
	}
}
