import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import { SvelteItemSheet } from '#lib/SvelteItemSheet.svelte.js';

import BackgroundSheetComponent from '../../view/sheets/BackgroundSheet.svelte';

export default class BackgroundSheet extends SvelteApplicationMixin(SvelteItemSheet) {
	protected root = BackgroundSheetComponent;

	constructor(item: { document: Item }, options: Record<string, unknown> = {}) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}) as Record<string, unknown>,
		);

		this.props = {
			item: this.document,
			sheet: this,
		};
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

	async toggleBackgroundCategoryOption(selectedCategory: string): Promise<void> {
		await this.document.update({ 'system.category': selectedCategory } as Record<string, unknown>);
	}
}
