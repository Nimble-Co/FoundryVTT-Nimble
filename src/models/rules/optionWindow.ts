import type { OptionSet } from '#types/optionWindow.d.ts';
import { CONTROL_OPTION_SET, OPTION_SETS } from '../../utils/demandControl/optionSets.js';
import type {
	RerollTrigger,
	RollEffect,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels, type RollUseContext } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	const tick = (name: string) =>
		new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `NIMBLE.rules.optionWindow.${name}.label`,
			hint: `NIMBLE.rules.optionWindow.${name}.hint`,
		});
	return {
		optionSet: new fields.StringField({
			required: true,
			nullable: false,
			initial: CONTROL_OPTION_SET,
			choices: choiceLabels('optionWindow', 'optionSet', OPTION_SETS),
			label: 'NIMBLE.rules.optionWindow.optionSet.label',
			hint: 'NIMBLE.rules.optionWindow.optionSet.hint',
		}),
		opensOnUse: tick('opensOnUse'),
		oncePerRound: tick('oncePerRound'),
		cardRow: tick('cardRow'),
		ignoresDisadvantage: tick('ignoresDisadvantage'),
		triggerTwice: tick('triggerTwice'),
		type: new fields.StringField({ required: true, nullable: false, initial: 'optionWindow' }),
	};
}

declare namespace OptionWindowRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The window with the options of its option set, for the hero to choose from.
 * The item that has the rule can open it when used, or by a row on the card of
 * a missed spell and on a save card where a target saved against an effect of
 * the owner.
 */
class OptionWindowRule extends NimbleBaseRule<OptionWindowRule.Schema> {
	declare optionSet: OptionSet;
	declare opensOnUse: boolean;
	declare oncePerRound: boolean;
	declare cardRow: boolean;
	declare ignoresDisadvantage: boolean;
	declare triggerTwice: boolean;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.optionWindow.description';
	static override icon = 'fa-solid fa-hand';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['optionSet'] },
		{ fields: ['opensOnUse', 'oncePerRound', 'ignoresDisadvantage'] },
		{ fields: ['cardRow'] },
		{ fields: ['triggerTwice'] },
	];

	static override defineSchema(): OptionWindowRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['optionSet', 'string'],
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
		if (!this.cardRow || !this.isOnActor || !this.test()) return false;
		if (context.side !== 'roller' || context.roll.kind !== 'attack') return false;
		const uuid = context.roll.itemUuid;
		const item = uuid ? (fromUuidSync(uuid) as { type?: string } | null) : null;
		return item?.type === 'spell';
	}

	get rollEffect(): RollEffect {
		return 'optionWindow';
	}

	get outcome(): RerollTrigger {
		return 'miss';
	}

	get oncePerRoll(): boolean {
		return true;
	}
}

export { OptionWindowRule };
