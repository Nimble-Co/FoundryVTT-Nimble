import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		description: new fields.HTMLField({ required: true, nullable: false, initial: '' }),
		target: new fields.ArrayField(new fields.StringField({ required: true, nullable: false }), {
			required: true,
			nullable: false,
		}),
		title: new fields.StringField({ required: true, nullable: false, initial: '' }),
		visibility: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'all',
			choices: ['all', 'gmOnly', 'owner'],
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'note' }),
	};
}

declare namespace NoteRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class NoteRule extends NimbleBaseRule<NoteRule.Schema> {
	static override defineSchema(): NoteRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['description', 'string'],
				['target', 'string[]'],
				['title', 'string'],
				[
					'visibility',
					"'all' <span class=\"nimble-type-summary__operator\">|</span> 'gmOnly' <span class=\"nimble-type-summary__operator\">|</span> 'owner'",
				],
			]),
		);
	}
}

export { NoteRule };
