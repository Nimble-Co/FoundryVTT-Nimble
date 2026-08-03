import type { NimbleAncestryData } from '../../models/item/AncestryDataModel.js';

import { NimbleBaseItem } from './base.svelte.js';

/** The slice of the parent character this item touches when it replaces an ancestry. */
interface AncestryHost {
	ancestry?: { delete(): Promise<unknown> };
	ancestryBonus?: { delete(): Promise<unknown> };
	createEmbeddedDocuments(type: 'Item', data: Record<string, unknown>[]): Promise<unknown>;
}

/**
 * Swaps the character's bonus trait along with the ancestry.
 *
 * The trait belongs to the ancestry that granted it, so leaving the outgoing one attached
 * keeps its rules applying under an ancestry that never granted them.
 */
async function replaceAncestryBonus(
	incomingAncestry: NimbleAncestryItem,
	actor: AncestryHost,
): Promise<void> {
	const defaultBonusUuid = incomingAncestry.system.defaultBonus;

	const dropExistingBonus = async () => {
		if (actor.ancestryBonus) await actor.ancestryBonus.delete();
	};

	if (!defaultBonusUuid) {
		await dropExistingBonus();
		return;
	}

	const defaultBonus = (await fromUuid(defaultBonusUuid as `Item.${string}`)) as {
		toObject(): Record<string, unknown> & { _stats: { compendiumSource: string } };
	} | null;

	if (!defaultBonus) {
		console.warn(
			`Nimble | ${incomingAncestry.name}: default bonus "${defaultBonusUuid}" could not be resolved.`,
		);
		await dropExistingBonus();
		return;
	}

	const source = defaultBonus.toObject();
	source._stats.compendiumSource = defaultBonusUuid;

	// Creating the replacement is what removes the outgoing trait: an ancestry bonus's own
	// `_preCreate` deletes whichever bonus the character already has.
	await actor.createEmbeddedDocuments('Item', [source]);
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
	override async _preCreate(
		data: Item.CreateData,
		options: Item.Database.PreCreateOptions,
		user: User,
	) {
		if (this.isEmbedded) {
			const actor = this.parent;
			if (!actor || actor.type !== 'character') return false;

			const host = actor as object as AncestryHost;

			if (host.ancestry) await host.ancestry.delete();

			await replaceAncestryBonus(this, host);
		}

		return super._preCreate(data, options, user);
	}
}
