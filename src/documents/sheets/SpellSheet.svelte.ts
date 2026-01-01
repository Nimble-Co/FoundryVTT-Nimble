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
			height: 'auto' as const,
		},
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

	async toggleSpellSchoolOption(selectedSchool: string | number): Promise<void> {
		if (typeof selectedSchool === 'number') return;

		const system = this.document.system as { school?: string };
		await this.document.update({
			'system.school': system.school === selectedSchool ? '' : selectedSchool,
		} as object);
	}

	async toggleSpellTierOption(selectedTier: string | number): Promise<void> {
		let selectedTierNumber = selectedTier;
		if (typeof selectedTier === 'string') selectedTierNumber = Number.parseInt(selectedTier, 10);
		await this.document.update({ 'system.tier': selectedTierNumber } as object);
	}

	async toggleSpellPropertyOption(selectedProperty: string): Promise<void> {
		const system = this.document.system as { properties?: { selected?: string[] } };
		const selectedProperties = new Set(system.properties?.selected ?? []);

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
		} as object);
	}
}
