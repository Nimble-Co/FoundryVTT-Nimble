import { EQUIPMENT_SWAP_BONUS_PATH } from '#utils/equipmentSwaps.js';
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
				label: 'NIMBLE.rules.equipmentSwapBonus.value.label',
				hint: 'NIMBLE.rules.equipmentSwapBonus.value.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'equipmentSwapBonus',
		}),
	};
}

declare namespace EquipmentSwapBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class EquipmentSwapBonusRule extends NimbleBaseRule<EquipmentSwapBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.equipmentSwapBonus.description';

	declare value: string;

	static override defineSchema(): EquipmentSwapBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['value', 'string']]));
	}

	prePrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;
		const current =
			(foundry.utils.getProperty(actor.system, EQUIPMENT_SWAP_BONUS_PATH) as number) ?? 0;
		foundry.utils.setProperty(
			actor.system,
			EQUIPMENT_SWAP_BONUS_PATH,
			current + (this.resolveFormula(this.value) ?? 0),
		);
	}
}

export { EquipmentSwapBonusRule };
