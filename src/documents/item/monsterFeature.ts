import type { NimbleMonsterFeatureData } from '../../models/item/MonsterFeatureDataModel.js';

import enrichDocumentHTML from '../../utils/enrichDocumentHTML.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleMonsterFeatureItem extends NimbleBaseItem<'monsterFeature'> {
	declare system: NimbleMonsterFeatureData;

	override async prepareChatCardData(_options) {
		const showDescription = this.system.activation.showDescription;
		const description = await enrichDocumentHTML(this.system.description, this);

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
