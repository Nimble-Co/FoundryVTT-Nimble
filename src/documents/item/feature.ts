import type { NimbleFeatureData } from '../../models/item/FeatureDataModel';

import { NimbleBaseItem } from './base.svelte';

export class NimbleFeatureItem extends NimbleBaseItem {
	declare system: NimbleFeatureData;

	override _populateBaseTags(): void {
		super._populateBaseTags();

		if (this.system.class) this.tags.add(`class:${this.system.class}`);
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();
	}

	override async prepareChatCardData() {
		const showDescription = this.system.activation.showDescription;
		const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description,
		);
		console.log(description);

		return {
			system: {
				description: showDescription ? description : '',
				featureType: this.type,
				class: this.system.class,
				name: this.name,
			},
			type: 'feature',
		};
	}
}
