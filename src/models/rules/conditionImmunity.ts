import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		conditions: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				choices: () => Object.keys(CONFIG.NIMBLE.conditions),
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'Immune to',
				hint: 'The actor is fully immune to these conditions and cannot be affected by them.',
			},
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'conditionImmunity' }),
	};
}

declare namespace ConditionImmunityRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		conditionImmunities?: Set<string>;
	};
}

/**
 * Rule that grants immunity to one or more conditions.
 * Immune conditions are accumulated in a Set on the actor and checked
 * by the nimble.preApplyCondition hook listener to block application.
 */
class ConditionImmunityRule extends NimbleBaseRule<ConditionImmunityRule.Schema> {
	static override group = 'conditions';
	static override description = 'NIMBLE.ruleDescriptions.conditionImmunity';

	declare conditions: string[];

	static override defineSchema(): ConditionImmunityRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['conditions', 'string[]']]));
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;
		if (this.conditions.length === 0) return;

		const { actor } = item;
		const actorSystem = actor as object as ActorSystem;

		if (!actorSystem.system.conditionImmunities) {
			foundry.utils.setProperty(actor.system, 'conditionImmunities', new Set<string>());
		}

		for (const condition of this.conditions) {
			actorSystem.system.conditionImmunities!.add(condition);
		}
	}
}

export { ConditionImmunityRule };
