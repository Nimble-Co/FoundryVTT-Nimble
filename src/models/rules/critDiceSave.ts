import type {
	RerollTrigger,
	RollEffect,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import {
	canPayRerollCost,
	chargeOnlyCost,
	type RerollCost,
} from '../../utils/reroll/rerollCost.js';
import type { RuleFormGroup } from './_formLayout.js';
import type { RollUseContext } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		saveType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'strength',
			choices: () => CONFIG.NIMBLE.savingThrows,
			label: 'NIMBLE.rules.critDiceSave.saveType.label',
			hint: 'NIMBLE.rules.critDiceSave.saveType.hint',
		}),
		saveDC: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '10',
				label: 'NIMBLE.rules.critDiceSave.saveDC.label',
				hint: 'NIMBLE.rules.critDiceSave.saveDC.hint',
				widget: 'formula',
			}),
		),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: false,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.critDiceSave.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.critDiceSave.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'critDiceSave' }),
	};
}

declare namespace CritDiceSaveRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A row on an attack with dice of the crit bonus role: spend a use, and the target makes a
 * save on a normal save card. A failed save sets the dice to their max. A passed
 * save gives the use back. Before there is a result, nothing changes.
 */
class CritDiceSaveRule extends NimbleBaseRule<CritDiceSaveRule.Schema> {
	declare saveType: keyof typeof CONFIG.NIMBLE.savingThrows;
	declare saveDC: string;
	declare chargePoolIdentifier: string;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.critDiceSave.description';
	static override icon = 'fa-solid fa-person-falling';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['saveType', 'saveDC'] },
		{
			label: 'NIMBLE.rules.reroll.form.cost.label',
			hint: 'NIMBLE.rules.reroll.form.cost.hint',
			fields: ['chargePoolIdentifier'],
		},
	];

	static override defineSchema(): CritDiceSaveRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['saveType', 'string'],
				['saveDC', 'string'],
				['chargePoolIdentifier', 'string'],
			]),
		);
	}

	/** It needs one target to make the save, and a use left. */
	offersUseOn(context: RollUseContext): boolean {
		if (!this.item.isEmbedded || !this.test()) return false;
		if (context.side !== 'roller' || context.roll.kind !== 'attack' || !context.other) return false;
		return canPayRerollCost(this.actor as Actor | null, this.rollUseCost);
	}

	get rollEffect(): RollEffect {
		return 'critDiceSave';
	}

	get needsCritBonusDice(): boolean {
		return true;
	}

	get outcome(): RerollTrigger {
		return 'criticalHit';
	}

	get oncePerRoll(): boolean {
		return true;
	}

	get rollUseCost(): RerollCost {
		return chargeOnlyCost((this.chargePoolIdentifier ?? '').trim());
	}
}

export { CritDiceSaveRule };
