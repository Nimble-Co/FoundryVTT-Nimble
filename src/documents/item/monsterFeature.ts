import type { NimbleMonsterFeatureData } from '../../models/item/MonsterFeatureDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

export class NimbleMonsterFeatureItem extends NimbleBaseItem {
	declare system: NimbleMonsterFeatureData;

	override async prepareChatCardData(_options) {
		const showDescription = this.system.activation.showDescription;
		const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description,
		);

		const targets = this.system.activation.targets;

		return {
			system: {
				description: showDescription ? description : '',
				featureType: this.type,
				class: '',
				name: this.name,
				attackType: targets?.attackType || '',
				attackDistance: targets?.distance || 1,
			},
			type: 'feature',
		};
	}
}
