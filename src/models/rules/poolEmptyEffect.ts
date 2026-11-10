import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.poolEmptyEffect';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'poolEmptyEffect' }),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: `${WORDS}.chargePoolIdentifier.label`,
				hint: `${WORDS}.chargePoolIdentifier.hint`,
				widget: 'chargePoolPicker',
			}),
		),
	};
}

declare namespace PoolEmptyEffectRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * On the owner's own turn, while the charge pool has no charges, the owner has the item's effect.
 * The effect's Lasts Until ends it.
 */
class PoolEmptyEffectRule extends NimbleBaseRule<PoolEmptyEffectRule.Schema> {
	declare chargePoolIdentifier: string;

	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-battery-empty';
	static override formLayout: readonly RuleFormGroup[] = [{ fields: ['chargePoolIdentifier'] }];

	static override defineSchema(): PoolEmptyEffectRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** Its predicate passes now. */
	isLive(): boolean {
		return this.test();
	}
}

export { PoolEmptyEffectRule };
