import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import { NimbleBaseRule, type PreCreateArgs } from './base.js';

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

	/** ID of the item granted by this rule, set during preCreate */
	grantedId: string | null = null;

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

	override async preCreate(args: PreCreateArgs): Promise<void> {
		if (this.inMemoryOnly || this.invalid) return;

		const { itemSource, pendingItems, operation } = args;

		const { uuid } = this;
		// TODO: Check if this is an embedded uuid

		const grantedItem = await (async () => {
			try {
				return (await fromUuid(uuid)) as NimbleBaseItem | null;
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
				return null;
			}
		})();

		// TODO: Check if it's actually an item
		if (!grantedItem) return;

		if (!this.test()) return;

		// Find existing item by sourceId using the real NimbleBaseItem type
		const existingItem = this.actor.items.find((i) => {
			const nimbleItem = i as NimbleBaseItem;
			return nimbleItem.sourceId === uuid;
		});
		if (!this.allowDuplicate && existingItem) {
			// TODO: Warn user and update grant

			return;
		}

		itemSource._id ??= foundry.utils.randomID();
		const grantedSource = grantedItem.toObject();
		grantedSource._id = foundry.utils.randomID();

		interface ItemSourceWithRules {
			rules: { type: string }[];
		}

		if (this.item.sourceId === (grantedSource._stats.compendiumSource ?? '')) {
			const systemWithRules = grantedSource.system as ItemSourceWithRules;
			systemWithRules.rules = systemWithRules.rules.filter((r) => r.type !== 'GrantItem');
		}

		// TODO: Effects

		grantedSource._stats.compendiumSource = uuid;

		// TODO: Apply Alteration

		// Create a temporary item - Item class will be NimbleBaseItem at runtime
		// We need to use a type assertion here because the Item constructor returns
		// the base Item type, but at runtime it will be a NimbleBaseItem instance
		interface ItemWithGrantedBy extends Item {
			grantedBy: Item | null;
		}
		const tempGranted = new Item(foundry.utils.deepClone(grantedSource), {
			parent: this.actor,
		}) as ItemWithGrantedBy;
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
