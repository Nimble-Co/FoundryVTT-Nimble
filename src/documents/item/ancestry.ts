import type { NimbleAncestryData } from '../../models/item/AncestryDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

// Interface for character actors with ancestry property
interface CharacterActorWithAncestry {
	ancestry?: NimbleAncestryItem | null;
	type: string;
}

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
	protected override async _preCreate(
		data: Parameters<Item['_preCreate']>[0],
		options: Parameters<Item['_preCreate']>[1],
		user: Parameters<Item['_preCreate']>[2],
	): Promise<boolean | undefined> {
		if (this.isEmbedded && this.parent) {
			const actor = this.parent as unknown as CharacterActorWithAncestry;
			if (actor.type !== 'character') return false;

			const existingAncestry = actor.ancestry;
			if (existingAncestry) await existingAncestry.delete();
		}

		const result = await super._preCreate(data, options, user);
		return result ?? undefined;
	}
}
