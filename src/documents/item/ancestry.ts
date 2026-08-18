import type { NimbleAncestryData } from '../../models/item/AncestryDataModel.js';

import localize from '../../utils/localize.js';
import { NimbleBaseItem } from './base.svelte.js';

/** The slice of the parent character this item touches when it replaces an ancestry. */
interface AncestryHost {
	ancestry?: { delete(): Promise<unknown> };
	ancestryBonus?: { delete(): Promise<unknown> };
	createEmbeddedDocuments(type: 'Item', data: Record<string, unknown>[]): Promise<unknown>;
}

/**
 * Extra create-operation flags this item reads.
 *
 * Foundry forwards unknown keys on the operation straight through to `_preCreate`, so a caller
 * that already knows which bonus the character should end up with can say so.
 */
export interface AncestryCreateOptions {
	/**
	 * The same create batch already carries the character's `ancestryBonus`, so the ancestry must
	 * not create its default one. Set by `submitCharacterCreation`.
	 */
	nimbleAncestryBonusInBatch?: boolean;
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

	// An ancestry with no default declares no opinion about the bonus — that's the homebrew and
	// module case the selection UI treats as "choose any bonus". Deleting the character's pick
	// there would throw away a deliberate choice, so leave it attached.
	if (!defaultBonusUuid) return;

	const defaultBonus = (await fromUuid(defaultBonusUuid as `Item.${string}`)) as {
		toObject(): Record<string, unknown> & { _stats?: { compendiumSource?: string } };
	} | null;

	if (!defaultBonus) {
		console.warn(
			`Nimble | ${incomingAncestry.name}: default bonus "${defaultBonusUuid}" could not be resolved.`,
		);
		if (actor.ancestryBonus) await actor.ancestryBonus.delete();
		return;
	}

	// Real documents always carry `_stats`, but `toObject()` is typed loosely enough that a stub
	// or a hand-built source can omit it — seed it rather than throwing on the assignment.
	const source = defaultBonus.toObject();
	source._stats = { ...source._stats, compendiumSource: defaultBonusUuid };

	// Creating the replacement is what removes the outgoing trait: an ancestry bonus's own
	// `_preCreate` deletes whichever bonus the character already has.
	await actor.createEmbeddedDocuments('Item', [source]);
}

export class NimbleAncestryItem extends NimbleBaseItem<'ancestry'> {
	declare system: NimbleAncestryData;

	/** ------------------------------------------------------ */
	//                        Data Prep
	/** ------------------------------------------------------ */
	override prepareBaseData(): void {
		// Read before the base class derives an identifier from the name.
		const authoredIdentifier = (this._source.system as { identifier?: string }).identifier ?? '';

		super.prepareBaseData();

		if (!authoredIdentifier) return;

		// A character who chose a variant carries an ancestry renamed to it ("Dryad" out of
		// "Dryad/Shroomling"), and the ancestry identifier is what keys the GM's language grants —
		// so the identifier the ancestry declares outranks the one its name would produce.
		//
		// Only ancestries: six shipped subclasses declare an identifier that is deliberately not
		// their name's slug ("chaos" for Invoker of Chaos), so honouring authored identifiers in
		// `NimbleBaseItem` would re-identify them.
		(this.system as object as { identifier: string }).identifier = authoredIdentifier;

		// The base tagged the item on its way through `_populateBaseTags`, back when the identifier
		// was still the one derived from the name. Rule predicates match against these tags, so they
		// have to be rebuilt from the identifier that won rather than left disagreeing with it.
		this.tags = new Set();
		this._populateBaseTags();
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
				description:
					description || localize('NIMBLE.ancestryBonusSelection.noDescriptionAvailable'),
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
		user: User.Stored,
	) {
		if (this.isEmbedded) {
			const actor = this.parent;
			if (!actor || actor.type !== 'character') return false;

			const host = actor as object as AncestryHost;

			if (host.ancestry) await host.ancestry.delete();

			// Skip the default when the caller is already creating the bonus alongside us. Creating
			// it here would only get deleted again by that bonus's own `_preCreate`, and any
			// `grantItem` rule or active effect on it would run against a doomed document.
			const { nimbleAncestryBonusInBatch } = options as typeof options & AncestryCreateOptions;
			if (!nimbleAncestryBonusInBatch) await replaceAncestryBonus(this, host);
		}

		return super._preCreate(data, options, user);
	}
}
