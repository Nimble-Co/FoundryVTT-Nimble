import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'condition' }),
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
	};
}

declare namespace ConditionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ConditionRule extends NimbleBaseRule<ConditionRule.Schema> {
	static override defineSchema(): ConditionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override afterPrepareData(): void {
		if (this.invalid) return;
		if (!this.actor) return;
		if (!this.test()) return;

		(this.actor as object as { tags: Set<string> }).tags.add(`condition:${this.value}`);
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}
}

export { ConditionRule };
