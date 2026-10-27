import type { NimbleFeatureData } from '../../models/item/FeatureDataModel.js';

import enrichDocumentHTML from '../../utils/documents/enrichDocumentHTML.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleFeatureItem extends NimbleBaseItem<'feature'> {
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
		const description = await enrichDocumentHTML(this.system.description, this);
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
