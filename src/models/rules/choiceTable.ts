import type {
	RerollTrigger,
	RollEffect,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RuleFormGroup } from './_formLayout.js';
import type { RollUseContext } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	const tick = (name: string) =>
		new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `NIMBLE.rules.choiceTable.${name}.label`,
			hint: `NIMBLE.rules.choiceTable.${name}.hint`,
		});
	return {
		opensOnUse: tick('opensOnUse'),
		oncePerRound: tick('oncePerRound'),
		cardRow: tick('cardRow'),
		ignoresDisadvantage: tick('ignoresDisadvantage'),
		triggerTwice: tick('triggerTwice'),
		type: new fields.StringField({ required: true, nullable: false, initial: 'choiceTable' }),
	};
}

declare namespace ChoiceTableRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The window with the options of a table the hero chooses from. The item that
 * has the rule can open it when used, or by a row on the card of a missed spell
 * and on a save card where a target saved against an effect of the owner.
 */
class ChoiceTableRule extends NimbleBaseRule<ChoiceTableRule.Schema> {
	declare opensOnUse: boolean;
	declare oncePerRound: boolean;
	declare cardRow: boolean;
	declare ignoresDisadvantage: boolean;
	declare triggerTwice: boolean;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.choiceTable.description';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['opensOnUse', 'oncePerRound', 'ignoresDisadvantage'] },
		{ fields: ['cardRow'] },
		{ fields: ['triggerTwice'] },
	];

	static override defineSchema(): ChoiceTableRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['opensOnUse', 'boolean'],
				['oncePerRound', 'boolean'],
				['cardRow', 'boolean'],
				['ignoresDisadvantage', 'boolean'],
				['triggerTwice', 'boolean'],
			]),
		);
	}

	protected override _autoSuppressesActivationCard(): boolean {
		return this.opensOnUse;
	}

	/** A spell that missed, on the attack of the owner. */
	offersUseOn(context: RollUseContext): boolean {
		if (!this.cardRow || !this.item.isEmbedded || !this.test()) return false;
		if (context.side !== 'roller' || context.roll.kind !== 'attack') return false;
		const uuid = context.roll.itemUuid;
		const item = uuid ? (fromUuidSync(uuid as never) as { type?: string } | null) : null;
		return item?.type === 'spell';
	}

	get rollEffect(): RollEffect {
		return 'choiceTable';
	}

	get outcome(): RerollTrigger {
		return 'miss';
	}

	get oncePerRoll(): boolean {
		return true;
	}
}

export { ChoiceTableRule };
