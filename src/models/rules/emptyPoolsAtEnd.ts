import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.emptyPoolsAtEnd';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'emptyPoolsAtEnd' }),
		pools: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				label: `${WORDS}.pools.label`,
				hint: `${WORDS}.pools.hint`,
			},
		),
	};
}

declare namespace EmptyPoolsAtEndRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When its effect ends, the named dice pools are emptied. It has no lifecycle hooks:
 * `src/hooks/emptyPoolsAtEnd.ts` reads it when the effect is deleted.
 */
class EmptyPoolsAtEndRule extends NimbleBaseRule<EmptyPoolsAtEndRule.Schema> {
	static override worksOnItems = false;

	static override group = 'resource';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-hourglass-end';

	declare pools: string[];

	static override defineSchema(): EmptyPoolsAtEndRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['pools', 'string[]']]));
	}

	/** The pool identifiers it names, with blanks left out. */
	get poolIdentifiers(): string[] {
		return this.pools.map((pool) => pool.trim()).filter((pool) => pool.length > 0);
	}
}

export { EmptyPoolsAtEndRule };
