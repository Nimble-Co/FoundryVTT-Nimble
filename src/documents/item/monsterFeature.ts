import type { NimbleMonsterFeatureData } from '../../models/item/MonsterFeatureDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

export class NimbleMonsterFeatureItem extends NimbleBaseItem {
	declare system: NimbleMonsterFeatureData;

	override async prepareChatCardData(options) {
		const showDescription = this.system.activation.showDescription;
		const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.system.description);

		return {
			system: {
				description: showDescription ? description : '',
				featureType: this.type,
				class: '',
				name: this.name,
			},
			type: 'feature',
		};
	}
}
