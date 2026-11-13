import type { RollTable, TableRollWhen } from '#types/chaos.d.ts';
import { CHAOS_TABLE, ROLL_TABLES } from '../../utils/chaos/rollTables.js';
import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const TABLE_ROLL_WHEN: readonly TableRollWhen[] = ['lessManaOrCrit', 'onUse'];

function schema() {
	const { fields } = foundry.data;
	return {
		table: new fields.StringField({
			required: true,
			nullable: false,
			initial: CHAOS_TABLE,
			choices: choiceLabels('tableRoll', 'table', ROLL_TABLES),
			label: 'NIMBLE.rules.tableRoll.table.label',
			hint: 'NIMBLE.rules.tableRoll.table.hint',
		}),
		when: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'lessManaOrCrit',
			choices: choiceLabels('tableRoll', 'when', TABLE_ROLL_WHEN),
			label: 'NIMBLE.rules.tableRoll.when.label',
			hint: 'NIMBLE.rules.tableRoll.when.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'tableRoll' }),
	};
}

declare namespace TableRollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * A roll on the rule's table: from the spell tick for 1 less mana or a crit, or
 * when the rule's item is used. The system shows the text of the table, and
 * applies no effect.
 */
class TableRollRule extends NimbleBaseRule<TableRollRule.Schema> {
	declare table: RollTable;
	declare when: TableRollWhen;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.tableRoll.description';
	static override icon = 'fa-solid fa-hat-wizard';

	static override defineSchema(): TableRollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['table', 'string'],
				['when', 'string'],
			]),
		);
	}

	get invokesChaos(): boolean {
		return this.isOnActor && this.test();
	}
}

export { TableRollRule };
