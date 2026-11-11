import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.tags';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'tags' }),
		tags: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			{
				required: true,
				nullable: false,
				label: `${WORDS}.tags.label`,
				hint: `${WORDS}.tags.hint`,
			},
		),
	};
}

declare namespace TagsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface TaggedActor {
	tags: Set<string>;
}

/** Adds domain tags to the actor while the item is on it, or while the effect is on it and enabled. */
class TagsRule extends NimbleBaseRule<TagsRule.Schema> {
	static override group = 'conditions';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-tags';

	declare tags: string[];

	static override defineSchema(): TagsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['tags', 'string[]']]));
	}

	/**
	 * Runs in prePrepareData so afterPrepareData rules see the tags. A rule that reads these tags
	 * in its own prePrepareData needs a higher priority than this rule (default 1).
	 */
	prePrepareData(): void {
		if (!this.isOnActor) return;
		if (this.#onDisabledEffect()) return;
		if (!this.test()) return;
		const actor = this.actor as unknown as TaggedActor;
		for (const tag of this.tags) {
			const trimmed = tag.trim();
			if (trimmed) actor.tags.add(trimmed);
		}
	}

	#onDisabledEffect(): boolean {
		const parent = this.parentDocument as { documentName?: string; disabled?: boolean };
		return parent.documentName === 'ActiveEffect' && parent.disabled === true;
	}
}

export { TagsRule };
