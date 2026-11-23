import {
	partyInventoryStoredName,
	readPartyInventory,
} from '#documents/actor/partyInventoryHolder.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import type {
	PartyInventorySheetItem,
	PartyInventorySheetProps,
} from '#types/components/actorSheets/PartyInventorySheet.d.ts';
import { COIN_ABBREVIATION, COIN_DENOMINATIONS } from '#utils/coins.ts';
import localize from '#utils/localize.js';
import type { TransferItem } from '#utils/partyInventory/planItemTransfer.ts';
import { OBJECT_SIZE_TYPES_WITH_QUANTITY } from '../../../models/item/objectQuantity.js';
import PartyInventorySheetComponent from './PartyInventorySheet.svelte';

function quantityOf(item: TransferItem): number {
	const number = Math.floor(Number(item.system?.quantity));
	return Number.isFinite(number) && number > 0 ? number : 1;
}

function carriesQuantity(item: TransferItem): boolean {
	return OBJECT_SIZE_TYPES_WITH_QUANTITY.has(String(item.system?.objectSizeType ?? ''));
}

function storedItems(inventory: ReturnType<typeof readPartyInventory>): PartyInventorySheetItem[] {
	const coins = COIN_DENOMINATIONS.filter((coin) => inventory.currency[coin] > 0).map(
		(coin): PartyInventorySheetItem => ({
			id: `coin-${coin}`,
			name: localize('NIMBLE.actorSheet.hero.inventory.coinBalance', {
				count: String(inventory.currency[coin]),
				coin: localize(COIN_ABBREVIATION[coin]),
			}),
			icon: 'fa-solid fa-coins',
			quantity: '',
		}),
	);
	const items = inventory.items.flatMap((item): PartyInventorySheetItem[] => {
		const name = item.name?.trim();
		if (!name) return [];
		const quantity = quantityOf(item);
		return [
			{
				id: item._id,
				name,
				img: item.img || 'icons/svg/item-bag.svg',
				quantity:
					carriesQuantity(item) && quantity > 1
						? localize('NIMBLE.actorSheet.hero.inventory.quantity', { count: String(quantity) })
						: '',
			},
		];
	});
	return [...coins, ...items];
}

function sheetProps(): PartyInventorySheetProps {
	return {
		empty: localize('NIMBLE.actorSheet.hero.inventory.partyEmpty'),
		items: storedItems(readPartyInventory()),
	};
}

/** The party inventory actor. A list of stored items, not the monster sheet. */
export default class PartyInventorySheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected root;

	constructor(actor: { document: Actor }, options = {} as SvelteApplicationRenderContext) {
		super(foundry.utils.mergeObject(options, { document: actor.document }));
		this.root = PartyInventorySheetComponent;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--party-inventory'],
		window: {
			icon: 'fa-solid fa-box',
			resizable: true,
		},
		position: { width: 420, height: 360 },
	};

	/** The list is read here. Moves happen on a character's Inventory tab. */
	override get isEditable(): boolean {
		return false;
	}

	override get title(): string {
		return partyInventoryStoredName();
	}

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		return {
			...context,
			...sheetProps(),
		} as object as Awaited<ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>>;
	}
}
