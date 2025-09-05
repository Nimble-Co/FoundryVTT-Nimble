import type { NimbleObjectData } from '../../models/item/ObjectDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

export class NimbleObjectItem extends NimbleBaseItem {
	declare system: NimbleObjectData;

	override _populateBaseTags(): void {
		super._populateBaseTags();

		this.tags.add(`objectType:${this.system.objectType}`);
		this.system.properties.selected?.forEach((p) => this.tags.add(`property:${p}`));
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();
	}

	override async prepareChatCardData(options) {
		const showDescription = this.system.activation.showDescription;
		const publicDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.system.description.public);

		const unidentifiedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.unidentified,
		);

		return {
			system: {
				description: {
					public: showDescription ? publicDescription : '',
					unidentified: showDescription ? unidentifiedDescription : '',
				},
				name: { public: this.name, unidentified: this.system.unidentifiedName },
				isIdentified: this.system.identified,
				objectType: this.system.objectType,
				properties: this.system.properties.selected,
			},
			type: 'object',
		};
	}

	/** ------------------------------------------------------ */
	//                 Document Update Hooks
	/** ------------------------------------------------------ */
	override async _preCreate(data, options, user) {
		// Update quantity if object already exists and is stackable
		if (this.isEmbedded && this.system.stackable) {
			const existing = this.actor?.items.find(
				(i) => i.name === this.name && i.type === 'object' && i.system.stackable,
			);

			if (!existing) return super._preCreate(data, options, user);

			// Update existing item quantity
			existing.update({ 'system.quantity': existing.system.quantity + 1 });
			return false;
		}

		return super._preCreate(data, options, user);
	}
}
