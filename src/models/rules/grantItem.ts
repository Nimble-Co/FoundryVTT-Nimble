import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import { NimbleBaseRule } from './base.js';

// Interface for preCreate arguments
interface PreCreateArgs {
	itemSource: { _id?: string };
	pendingItems: Item.Source[];
	operation: { keepId?: boolean };
	tempItems: Item[];
}

// Interface for item with grantedBy property
interface GrantableItem extends Item {
	grantedBy?: Item;
}

function schema() {
	const { fields } = foundry.data;

	return {
		allowDuplicate: new fields.BooleanField({ required: true, nullable: false, initial: true }),
		inMemoryOnly: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		uuid: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantItem' }),
	};
}

declare namespace ItemGrantRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ItemGrantRule extends NimbleBaseRule<ItemGrantRule.Schema> {
	declare allowDuplicate: boolean;
	declare inMemoryOnly: boolean;
	declare uuid: string;
	declare grantedId: string;

	static override defineSchema(): ItemGrantRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['allowDuplicate', 'boolean'],
				['inMemoryOnly', 'boolean'],
				['uuid', 'string'],
			]),
		);
	}

	async preCreate(args: PreCreateArgs): Promise<void> {
		if (this.inMemoryOnly || this.invalid) return;

		const { itemSource, pendingItems, operation } = args;

		const { uuid } = this;
		// TODO: Check if this is an embedded uuid

		const grantedItem = await (async () => {
			try {
				return (await fromUuid(uuid as `Item.${string}`)) as NimbleBaseItem | null;
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
				return null;
			}
		})();

		// TODO: Check if it's actually an item
		if (!grantedItem) return;

		if (!this.test()) return;

		const existingItem = this.actor?.items.find(
			(i) => (i as unknown as NimbleBaseItem).sourceId === uuid,
		);
		if (!this.allowDuplicate && existingItem) {
			// TODO: Warn user and update grant

			return;
		}

		itemSource._id ??= foundry.utils.randomID();
		const grantedSource = grantedItem.toObject() as Item.Source & {
			system: { rules?: Array<{ type: string }> };
		};
		grantedSource._id = foundry.utils.randomID();

		const itemSourceId = (this.item as unknown as NimbleBaseItem | undefined)?.sourceId;
		if (itemSourceId === (grantedSource._stats.compendiumSource ?? '')) {
			const filteredRules = grantedSource.system.rules?.filter((r) => r.type !== 'GrantItem') ?? [];
			grantedSource.system.rules = filteredRules as typeof grantedSource.system.rules;
		}

		// TODO: Effects

		grantedSource._stats.compendiumSource = uuid;

		// TODO: Apply Alteration

		const tempGranted = new Item(foundry.utils.deepClone(grantedSource), {
			parent: this.actor,
		}) as GrantableItem;
		tempGranted.grantedBy = this.item;

		// TODO: Do data prep and rule prep for tempGranted

		// TODO: Apply Choice Selection

		if (this.disabled) return;

		args.tempItems.push(tempGranted);
		// TODO: Set class and feature predication

		this.grantedId = grantedSource._id;
		operation.keepId = true;

		pendingItems.push(grantedSource);
	}
}

export { ItemGrantRule };
