import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import SpellSheetComponent from '../../view/sheets/SpellSheet.svelte';

export default class SpellSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}),
		);

		this.root = SpellSheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--spell'],
		window: {
			icon: 'fa-solid fa-hand-sparkles',
			resizable: true,
		},
		position: {
			width: 288,
			height: 400,
		},
		actions: {},
	};

	protected override async _prepareContext() {
		return {
			item: this.item,
			sheet: this,
		};
	}

	async toggleSpellSchoolOption(selectedSchool: string | number): Promise<void> {
		if (typeof selectedSchool === 'number') return;

		await this.document.update({
			'system.school': this.document.system.school === selectedSchool ? '' : selectedSchool,
		});
	}

	async toggleSpellTierOption(selectedTier: string | number): Promise<void> {
		if (typeof selectedTier === 'string') selectedTier = Number.parseInt(selectedTier, 10);
		await this.document.update({ 'system.tier': selectedTier });
	}

	async toggleSpellPropertyOption(selectedProperty: string): Promise<void> {
		const selectedProperties = new Set(this.document.system.properties.selected);

		if (selectedProperties.has(selectedProperty)) selectedProperties.delete(selectedProperty);
		else {
			if (selectedProperty === 'range' && selectedProperties.has('reach')) {
				selectedProperties.delete('reach');
			}

			if (selectedProperty === 'reach' && selectedProperties.has('range')) {
				selectedProperties.delete('range');
			}

			selectedProperties.add(selectedProperty);
		}

		await this.document.update({
			'system.properties.selected': selectedProperties,
		});
	}
}
