import type { NimblePartyInventoryData } from '../../models/actor/PartyInventoryDataModel.js';
import { NimbleBaseActor } from './base.svelte.js';
import { partyInventoryStoredName } from './partyInventoryHolder.js';

/** The shared party list. It is not a creature, and it does not use the monster sheet. */
export class NimblePartyInventory extends NimbleBaseActor<'partyInventory'> {
	declare system: NimblePartyInventoryData;

	/** Deleting this actor would drop the shared list. */
	override canUserModify(...args: Parameters<NimbleBaseActor['canUserModify']>): boolean {
		if (args[1] === 'delete') return false;
		return super.canUserModify(...args);
	}

	protected override async _preCreate(
		_data: Actor.CreateData,
		options: Actor.Database.PreCreateOptions,
		user: User.Stored,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		this.updateSource({ name: partyInventoryStoredName() });
		return super._preCreate(_data, options, user);
	}

	override async _preUpdate(
		changes: Actor.UpdateData,
		options: Actor.Database.PreUpdateOptions,
		user: User.Stored,
	) {
		const name = partyInventoryStoredName();
		if (changes.name !== undefined && changes.name !== name) changes.name = name;
		return super._preUpdate(changes, options, user);
	}

	protected override async _preDelete(
		_options: Actor.Database.PreDeleteOptions,
		_user: User.Stored,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		return false;
	}
}
