import type { NimbleBaseItem } from '../../documents/item/base.svelte.js';
import { NimbleBaseRule } from './base.js';

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
	static override defineSchema(): ItemGrantRule.Schema {
		return {
			...super.defineSchema(),
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

	override async preCreate(args): Promise<void> {
		if (this.inMemoryOnly || this.invalid) return;

		const { itemSource, pendingItems, operation } = args;

		const { uuid } = this;
		// TODO: Check if this is an embedded uuid

		const grantedItem = await (async () => {
			try {
				return (await fromUuid(uuid)) as NimbleBaseItem;
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
				return null;
			}
		})();

		// TODO: Check if it's actually an item
		if (!grantedItem) return;

		if (!this.test()) return;

		const existingItem = this.actor.items.find((i) => i.sourceId === uuid);
		if (!this.allowDuplicate && existingItem) {
			// TODO: Warn user and update grant

			return;
		}

		itemSource._id ??= foundry.utils.randomID();
		const grantedSource = grantedItem.toObject();
		grantedSource._id = foundry.utils.randomID();

		if (this.item.sourceId === (grantedSource._stats.compendiumSource ?? '')) {
			// @ts-expect-error
			grantedSource.system.rules = grantedSource.system.rules.filter((r) => r.type !== 'GrantItem');
		}

		// TODO: Effects

		grantedSource._stats.compendiumSource = uuid;

		// TODO: Apply Alteration

		const tempGranted = new Item(foundry.utils.deepClone(grantedSource), { parent: this.actor });
		tempGranted.grantedBy = this.item;

		// TODO: Do data prep and rule prep for tempGranted

		// TODO: Apply Choice Selection

		if (this.disabled) return;

		args.tempItems.push(tempGranted);
		// TODO: Set class and feature predication

		// @ts-expect-error
		this.grantedId = grantedSource._id;
		operation.keepId = true;

		pendingItems.push(grantedSource);
	}
}

export { ItemGrantRule };
