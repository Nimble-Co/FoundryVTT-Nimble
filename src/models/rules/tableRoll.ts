import type { RollTable } from '#types/chaos.d.ts';
import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const ROLL_TABLES: readonly RollTable[] = ['chaos'];

function schema() {
	const { fields } = foundry.data;
	return {
		table: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'chaos',
			choices: choiceLabels('tableRoll', 'table', ROLL_TABLES),
			label: 'NIMBLE.rules.tableRoll.table.label',
			hint: 'NIMBLE.rules.tableRoll.table.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'tableRoll' }),
	};
}

declare namespace TableRollRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The spell dialog has a tick for 1 less mana. The tick or a crit rolls on the
 * rule's table. The system shows the text of the table, and applies no effect.
 */
class TableRollRule extends NimbleBaseRule<TableRollRule.Schema> {
	declare table: RollTable;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.tableRoll.description';

	static override defineSchema(): TableRollRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['table', 'string']]));
	}

	get invokesChaos(): boolean {
		return this.item.isEmbedded && this.test();
	}
}

export { TableRollRule };
