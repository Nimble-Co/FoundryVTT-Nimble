import type { NimbleAncestryBonusData } from '../../models/item/AncestryBonusDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

export class NimbleAncestryBonusItem extends NimbleBaseItem {
	declare system: NimbleAncestryBonusData;

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

			const existingBonus = (actor as object as { ancestryBonus?: NimbleAncestryBonusItem })
				.ancestryBonus;
			if (existingBonus) await existingBonus.delete();
		}

		return super._preCreate(data, options, user);
	}
}
