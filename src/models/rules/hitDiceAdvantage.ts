import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		// User-facing condition text (e.g., "in the wild", "underground", etc.)
		condition: new fields.StringField({ required: true, nullable: false, initial: '' }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'hitDiceAdvantage' }),
	};
}

declare namespace HitDiceAdvantageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class HitDiceAdvantageRule extends NimbleBaseRule<HitDiceAdvantageRule.Schema> {
	declare condition: string;

	static override defineSchema(): HitDiceAdvantageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['condition', 'string']]));
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;
		if (actor.type !== 'character') return;

		if (!this.test()) return;

		// Store the advantage rule for display in the rest dialog
		const advantageRules = (foundry.utils.getProperty(
			actor.system,
			'attributes.hitDiceAdvantageRules',
		) ?? []) as Array<{ id: string; label: string; condition: string; sourceId: string }>;

		advantageRules.push({
			id: this.id,
			label: this.label,
			condition: this.condition,
			sourceId: item.sourceId ?? item.uuid,
		});

		foundry.utils.setProperty(actor.system, 'attributes.hitDiceAdvantageRules', advantageRules);
	}
}

export { HitDiceAdvantageRule };
