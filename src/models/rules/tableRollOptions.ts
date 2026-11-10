import type { RollTable } from '#types/chaos.d.ts';
import { CHAOS_TABLE, ROLL_TABLES } from '../../utils/chaos/rollTables.js';
import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		table: new fields.StringField({
			required: true,
			nullable: false,
			initial: CHAOS_TABLE,
			choices: choiceLabels('tableRollOptions', 'table', ROLL_TABLES),
			label: 'NIMBLE.rules.tableRollOptions.table.label',
			hint: 'NIMBLE.rules.tableRollOptions.table.hint',
		}),
		rollTwice: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.tableRollOptions.rollTwice.label',
			hint: 'NIMBLE.rules.tableRollOptions.rollTwice.hint',
		}),
		chooseChargePool: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.tableRollOptions.chooseChargePool.label',
				hint: 'NIMBLE.rules.tableRollOptions.chooseChargePool.hint',
				widget: 'chargePoolPicker',
				showWhen: (data: Record<string, unknown>) => data.rollTwice === true,
			}),
		),
		advantage: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.tableRollOptions.advantage.label',
			hint: 'NIMBLE.rules.tableRollOptions.advantage.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'tableRollOptions' }),
	};
}

declare namespace TableRollOptionsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** What a table roll can do: roll twice, choose with a use, or roll with advantage. */
class TableRollOptionsRule extends NimbleBaseRule<TableRollOptionsRule.Schema> {
	declare table: RollTable;
	declare rollTwice: boolean;
	declare chooseChargePool: string;
	declare advantage: boolean;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.tableRollOptions.description';
	static override icon = 'fa-solid fa-dice';

	static override defineSchema(): TableRollOptionsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['table', 'string'],
				['rollTwice', 'boolean'],
				['chooseChargePool', 'string'],
				['advantage', 'boolean'],
			]),
		);
	}

	get applies(): boolean {
		return this.isOnActor && this.test();
	}
}

export { TableRollOptionsRule };
