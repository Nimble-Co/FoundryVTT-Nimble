import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'maximizeHitDice' }),
	};
}

declare namespace MaximizeHitDiceRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaximizeHitDiceRule extends NimbleBaseRule<MaximizeHitDiceRule.Schema> {
	static override defineSchema(): MaximizeHitDiceRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map());
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		if (actor.type !== 'character') return;

		if (!this.test()) return;

		// Set the flag to maximize hit dice rolls
		foundry.utils.setProperty(actor.system, 'attributes.maximizeHitDice', true);

		// Store contribution for display purposes
		const contributions = (foundry.utils.getProperty(
			actor.system,
			'attributes.maximizeHitDiceContributions',
		) ?? []) as Array<{ label: string }>;
		contributions.push({ label: this.label });
		foundry.utils.setProperty(
			actor.system,
			'attributes.maximizeHitDiceContributions',
			contributions,
		);
	}
}

export { MaximizeHitDiceRule };
