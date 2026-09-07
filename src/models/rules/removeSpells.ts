import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'removeSpells' }),
		uuids: new fields.ArrayField(
			new fields.StringField(
				withWidget({
					required: false,
					nullable: false,
					initial: '',
					widget: 'documentUuid',
					documentTypes: ['Item.spell'],
				}),
			),
			{
				required: false,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.removeSpells.uuids.label',
				hint: 'NIMBLE.rules.removeSpells.uuids.hint',
			},
		),
	};
}

declare namespace RemoveSpellsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Rule that removes specific spells from the actor when the feature is granted.
 * Only removes spells that were automation-granted (have a matching compendiumSource).
 * Processed by the level-up flow, not during actor data preparation.
 */
class RemoveSpellsRule extends NimbleBaseRule<RemoveSpellsRule.Schema> {
	static override group = 'grants';

	static override description = 'NIMBLE.rules.removeSpells.description';

	declare uuids: string[];

	static override defineSchema(): RemoveSpellsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['uuids', 'string[]']]));
	}
}

export { RemoveSpellsRule };
