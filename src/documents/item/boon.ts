import type { NimbleBoonData } from '../../models/item/BoonDataModel.js';

import enrichDocumentHTML from '../../utils/documents/enrichDocumentHTML.js';
import { NimbleBaseItem } from './base.svelte.js';

export class NimbleBoonItem extends NimbleBaseItem<'boon'> {
	declare system: NimbleBoonData;

	override async prepareChatCardData() {
		const description = await enrichDocumentHTML(this.system.description, this);

		return {
			author: game.user?.id,
			flavor: `${this.actor?.name}: ${this.name}`,
			type: 'feature',
			system: {
				description: description || 'No description available.',
				featureType: this.type,
				name: this.name,
			},
		};
	}
}
