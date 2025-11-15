import type { NimbleClassItem } from './class';
import type { NimbleSubclassData } from '../../models/item/SubclassDataModel';

import { NimbleBaseItem } from './base.svelte';
import { ClassResourceManager } from '../../managers/ClassResourceManager';

export class NimbleSubclassItem extends NimbleBaseItem {
	declare class: NimbleClassItem | null;

	declare system: NimbleSubclassData;

	declare resources: ClassResourceManager;

	/** ------------------------------------------------------ */
	/**                 Data Prep Functions                    */
	/** ------------------------------------------------------ */
	override prepareBaseData(): void {
		super.prepareBaseData();

		this.resources = new ClassResourceManager(this);
	}

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
}
