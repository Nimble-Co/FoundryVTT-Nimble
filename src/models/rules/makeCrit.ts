import type { RerollRollKind } from '../../utils/reroll/rollToReroll.js';
import type { RuleFormGroup } from './_formLayout.js';
import { RollUseRule } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const ATTACKS_ONLY: readonly RerollRollKind[] = ['attack'];

function schema() {
	const { fields } = foundry.data;
	const shared = RollUseRule.rollUseSchemaParts('makeCrit');
	const { usedBy, reach } = shared.roll;

	return {
		usedBy,
		reach,
		...shared.when,
		...shared.cost,
		...shared.note,
		type: new fields.StringField({ required: true, nullable: false, initial: 'makeCrit' }),
	};
}

declare namespace MakeCritRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Lets the one who attacked, the target, or an ally make an attack a crit
 * after it is rolled. The crit stays for the card. Always a choice, never
 * automatic. Read when a card is posted and again on the GM client when it is used.
 */
class MakeCritRule extends RollUseRule<MakeCritRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.makeCrit.description';
	static override formLayout: readonly RuleFormGroup[] = [
		...RollUseRule.useFormGroups(),
		RollUseRule.noteFormGroup(),
	];

	static override defineSchema(): MakeCritRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		const checkFields = new Set(['rolls', 'saves', 'skills', 'abilities']);
		return super.tooltipInfo(
			new Map(RollUseRule.rollUseTooltipTypes().filter(([name]) => !checkFields.has(name))),
		);
	}

	protected override usesOnRolls(): readonly RerollRollKind[] {
		return ATTACKS_ONLY;
	}
}

export { MakeCritRule };
