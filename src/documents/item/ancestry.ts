import type { NimbleAncestryData } from '../../models/item/AncestryDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

export class NimbleAncestryItem extends NimbleBaseItem {
	declare system: NimbleAncestryData;

	override async prepareChatCardData() {
		const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description,
		);

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

	/** ------------------------------------------------------ */
	//                 Document Update Hooks
	/** ------------------------------------------------------ */
	override async _preCreate(
		data: Item.CreateData,
		options: Item.Database.PreCreateOptions,
		user: User,
	) {
		if (this.isEmbedded) {
			const actor = this.parent;
			if (!actor || actor.type !== 'character') return false;

			const existingAncestry = (actor as object as { ancestry?: NimbleAncestryItem }).ancestry;
			if (existingAncestry) await existingAncestry.delete();
		}

		return super._preCreate(data, options, user);
	}
}
