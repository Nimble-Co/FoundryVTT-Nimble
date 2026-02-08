import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 1 }),
		mode: new fields.StringField({ required: true, nullable: false, initial: 'set' }),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'initiativeRollMode',
		}),
	};
}

declare namespace InitiativeRollModeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class InitiativeRollModeRule extends NimbleBaseRule<InitiativeRollModeRule.Schema> {
	declare value: number;
	declare mode: string;

	static override defineSchema(): InitiativeRollModeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['mode', '"set" | "adjust"'],
			]),
		);
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;

		const { actor } = item;

		interface ActorAttributes {
			attributes: {
				initiative: { defaultRollMode?: number };
			};
		}
		const actorSystem = actor.system as object as ActorAttributes;
		const currentRollMode = actorSystem.attributes.initiative.defaultRollMode ?? 0;

		let newRollMode: number;
		if (this.mode === 'set') {
			newRollMode = this.value;
		} else {
			// 'adjust' mode - add to current
			newRollMode = currentRollMode + this.value;
		}

		foundry.utils.setProperty(actor.system, 'attributes.initiative.defaultRollMode', newRollMode);
	}
}

export { InitiativeRollModeRule };
