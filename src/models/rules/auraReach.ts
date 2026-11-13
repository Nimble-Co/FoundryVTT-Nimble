import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.auraReach.value.label',
				hint: 'NIMBLE.rules.auraReach.value.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'auraReach' }),
	};
}

declare namespace AuraReachRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** The Reach of the hero's aura. Every rule adds to it; formulas read it as `@auraReach`. */
class AuraReachRule extends NimbleBaseRule<AuraReachRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.auraReach.description';

	declare value: string;

	static override defineSchema(): AuraReachRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	prePrepareData(): void {
		if (!this.isOnActor) return;
		if (!this.test()) return;

		const { actor } = this;
		const value = Number(this.resolveFormula(this.value)) || 0;
		const current = Number(foundry.utils.getProperty(actor.system, 'attributes.auraReach')) || 0;
		foundry.utils.setProperty(actor.system, 'attributes.auraReach', current + value);
	}
}

export { AuraReachRule };
