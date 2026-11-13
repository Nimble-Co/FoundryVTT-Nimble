import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;
	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'zeroHpAtEnd' }),
	};
}

declare namespace ZeroHpAtEndRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When its effect ends, by any path, the holder drops to 0 HP. It has no lifecycle hooks:
 * `src/utils/lastsUntil/zeroHpAtEnd.ts` reads it when the effect is deleted.
 */
class ZeroHpAtEndRule extends NimbleBaseRule<ZeroHpAtEndRule.Schema> {
	static override worksOnItems = false;
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.zeroHpAtEnd.description';
	static override icon = 'fa-solid fa-heart-crack';

	static override defineSchema(): ZeroHpAtEndRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}
}

export { ZeroHpAtEndRule };
