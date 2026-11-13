import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.dieResultEffect';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'dieResultEffect' }),
		itemIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			label: `${WORDS}.itemIdentifier.label`,
			hint: `${WORDS}.itemIdentifier.hint`,
		}),
		atLeast: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 1,
			initial: 6,
			label: `${WORDS}.atLeast.label`,
			hint: `${WORDS}.atLeast.hint`,
		}),
		notOnAllies: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `${WORDS}.notOnAllies.label`,
			hint: `${WORDS}.notOnAllies.hint`,
		}),
	};
}

declare namespace DieResultEffectRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When a use of the item that does not miss rolls at least `atLeast` on its Primary Die, each
 * target gets this item's effect. The effect's Lasts Until ends it.
 */
class DieResultEffectRule extends NimbleBaseRule<DieResultEffectRule.Schema> {
	declare itemIdentifier: string;

	declare atLeast: number;

	declare notOnAllies: boolean;

	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-dice-six';

	static override defineSchema(): DieResultEffectRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** Its predicate passes now. */
	isLive(): boolean {
		return this.isOnActor && this.test();
	}

	/** The rule reads uses of this item: the named item, or its own item when no name is set. */
	readsUseOf(item: { uuid?: string | null; system?: { identifier?: string } } | null): boolean {
		if (!item) return false;
		const identifier = this.itemIdentifier.trim();
		if (!identifier) return !!item.uuid && item.uuid === this.item?.uuid;
		return item.system?.identifier === identifier;
	}
}

export { DieResultEffectRule };
