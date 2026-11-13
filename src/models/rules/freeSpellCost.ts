import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.freeSpellCost';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'freeSpellCost' }),
		poolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: `${WORDS}.poolIdentifier.label`,
				hint: `${WORDS}.poolIdentifier.hint`,
				widget: 'chargePoolPicker',
			}),
		),
	};
}

declare namespace FreeSpellCostRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * While the effect is on, a spell whose class cost is paid from a charge pool costs nothing from
 * that pool. A mana cost does not change. The effect's Lasts Until ends it.
 */
class FreeSpellCostRule extends NimbleBaseRule<FreeSpellCostRule.Schema> {
	declare poolIdentifier: string;

	static override worksOnItems = false;

	static override group = 'resource';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-hand-sparkles';

	static override defineSchema(): FreeSpellCostRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** Whether a spell cost paid from this pool is free. A blank pool matches every pool. */
	makesFree(poolIdentifier: string): boolean {
		if (!this.isOnActor || !this.test()) return false;
		const own = this.poolIdentifier?.trim() ?? '';
		return own.length === 0 || own === poolIdentifier;
	}
}

export { FreeSpellCostRule };
