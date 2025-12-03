import type { NimbleSpellData } from '../../models/item/SpellDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

/** Spell system data with description fields */
interface SpellSystemData extends NimbleSpellData {
	description: {
		baseEffect: string;
		higherLevelEffect: string;
	};
}

export class NimbleSpellItem extends NimbleBaseItem {
	declare system: SpellSystemData;

	override _populateBaseTags() {
		super._populateBaseTags();

		if (this.system.school) this.tags.add(`school:${this.system.school}`);
		if (this.system.properties.selected) {
			for (const p of this.system.properties.selected) {
				this.tags.add(`property:${p}`);
			}
		}

		if (!this.tags.has('property:utility')) this.tags.add(`tier:${this.system.tier}`);
	}

	override _populateDerivedTags() {
		super._populateDerivedTags();
	}

	override async prepareChatCardData() {
		const showDescription = this.system.activation.showDescription;
		const baseEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.baseEffect ?? '',
		);

		const higherLevelEffect = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.higherLevelEffect ?? '',
		);

		return {
			system: {
				actorName: this.actor?.name ?? game?.user?.name ?? '',
				description: {
					baseEffect: showDescription ? baseEffect : '',
					higherLevelEffect: showDescription ? higherLevelEffect : '',
				},
				duration: {
					concentration: this.tags.has('property:concentration'),
					period: this.tags.has('property:utility'),
				},
				img: this.img ?? 'icons/svg/explosion.svg',
				tier: this.system.tier,
				school: this.system.school,
				spellName: this.name,
			},
			type: 'spell',
		};
	}
}
