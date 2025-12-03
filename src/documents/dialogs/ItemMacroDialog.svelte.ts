import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import ItemMacroDialogComponent from '../../view/dialogs/ItemMacroDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class ItemMacroDialog extends SvelteApplicationMixin(ApplicationV2) {
	item: Item;

	data: Record<string, unknown>;

	protected root = ItemMacroDialogComponent;

	constructor(
		item: Item,
		data: Record<string, unknown> = {},
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: item,
				window: {
					title: `${item.name}: Macro Configuration`,
				},
			}) as Record<string, unknown>,
		);

		this.data = data;
		this.item = item;
		this.props = { item, dialog: this, ...data };
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-terminal',
			resizable: true,
		},
		position: {
			width: 576,
			height: 'auto' as const,
		},
		actions: {},
	};
}
