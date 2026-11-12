import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		multiplier: new fields.NumberField({
			required: true,
			nullable: false,
			min: 0,
			initial: 1,
			label: 'NIMBLE.rules.damageRecoil.multiplier.label',
			hint: 'NIMBLE.rules.damageRecoil.multiplier.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageRecoil' }),
	};
}

declare namespace DamageRecoilRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When the owner deals damage, the owner takes that damage times the multiplier, ignoring armor.
 * Read on the GM client when the damage is applied.
 */
class DamageRecoilRule extends NimbleBaseRule<DamageRecoilRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.damageRecoil.description';
	static override icon = 'fa-solid fa-arrow-rotate-left';

	declare multiplier: number;

	static override defineSchema(): DamageRecoilRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['multiplier', 'number']]));
	}

	/** The damage the owner takes for dealing `dealt`, rounded down. */
	recoilFor(dealt: number): number {
		if (!this.isOnActor || !this.test() || !(dealt > 0)) return 0;
		return Math.floor(dealt * (Number(this.multiplier) || 0));
	}
}

export { DamageRecoilRule };
