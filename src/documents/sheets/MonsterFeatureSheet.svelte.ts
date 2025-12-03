import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import MonsterFeatureSheetComponent from '../../view/sheets/MonsterFeatureSheet.svelte';

export default class MonsterFeatureSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item: { document: Item }, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}) as Record<string, unknown>,
		);

		this.root = MonsterFeatureSheetComponent;
		this.props = { item: this.document, sheet: this };
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-hand-fist',
			resizable: true,
		},
		position: {
			width: 288,
			height: 'auto' as const,
		},
		actions: {},
	};
}
