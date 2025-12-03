import type { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import type { NimbleObjectData } from '../../models/item/ObjectDataModel.js';
import { NimbleBaseItem } from './base.svelte.js';

// Interface for rule with disabled property
interface ToggleableRule {
	disabled: boolean;
}

export class NimbleObjectItem extends NimbleBaseItem {
	declare system: NimbleObjectData;

	override _populateBaseTags(): void {
		super._populateBaseTags();

		this.tags.add(`objectType:${this.system.objectType}`);
		if (this.system.properties.selected) {
			for (const p of this.system.properties.selected) {
				this.tags.add(`property:${p}`);
			}
		}
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();
	}

	override async prepareChatCardData(_options: ItemActivationManager.ActivationOptions) {
		const showDescription = this.system.activation.showDescription;
		const publicDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			this.system.description.public as string,
		);

		const unidentifiedDescription =
			await foundry.applications.ux.TextEditor.implementation.enrichHTML(
				this.system.description.unidentified as string,
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
		// Update quantity if object already exists and is stackable or smallSized
		const objectSizeTypesWithQuantity = new Set(['stackable', 'smallSized']);
		if (this.isEmbedded && objectSizeTypesWithQuantity.has(this.system.objectSizeType)) {
			const existing = this.actor?.items.find(
				(i) =>
					i instanceof NimbleObjectItem &&
					i.name === this.name &&
					i.type === 'object' &&
					objectSizeTypesWithQuantity.has(i.system.objectSizeType),
			);

			if (!existing) return super._preCreate(data, options, user);

			// Update existing item quantity
			const existingObject = existing as NimbleObjectItem;
			existingObject.update({ 'system.quantity': existingObject.system.quantity + 1 } as Record<
				string,
				unknown
			>);
			return false;
		}

		return super._preCreate(data, options, user);
	}

	/** ------------------------------------------------------ */
	//                 Data Functions
	/** ------------------------------------------------------ */

	toggleArmor(): void {
		if (this.rules.hasRuleOfType('armorClass')) {
			const rule = this.rules.getRuleOfType('armorClass') as ToggleableRule | undefined;
			if (rule) {
				rule.disabled = !rule.disabled;
			}
		}
	}
}
