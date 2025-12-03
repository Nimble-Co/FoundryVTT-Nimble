import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import SpellSheetComponent from '../../view/sheets/SpellSheet.svelte';

// Interface for spell system data
interface SpellSystemData {
	school: string;
	tier: number;
	properties: {
		selected: Set<string> | string[];
	};
}

export default class SpellSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ItemSheetV2,
) {
	protected root;

	constructor(item: { document?: Item }, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: item.document,
			}) as Record<string, unknown>,
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
			height: 'auto',
		},
		actions: {},
	};

	// @ts-expect-error - Override with simplified context
	protected override async _prepareContext() {
		return {
			item: this.item,
			sheet: this,
		};
	}

	async toggleSpellSchoolOption(selectedSchool: string | number): Promise<void> {
		if (typeof selectedSchool === 'number') return;

		const system = this.document.system as unknown as SpellSystemData;
		await this.document.update({
			'system.school': system.school === selectedSchool ? '' : selectedSchool,
		} as Record<string, unknown>);
	}

	async toggleSpellTierOption(selectedTier: string | number): Promise<void> {
		let selectedTierNumber = selectedTier;
		if (typeof selectedTier === 'string') selectedTierNumber = Number.parseInt(selectedTier, 10);
		await this.document.update({ 'system.tier': selectedTierNumber } as Record<string, unknown>);
	}

	async toggleSpellPropertyOption(selectedProperty: string): Promise<void> {
		const system = this.document.system as unknown as SpellSystemData;
		const selectedProperties = new Set(system.properties.selected);

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
		} as Record<string, unknown>);
	}
}
