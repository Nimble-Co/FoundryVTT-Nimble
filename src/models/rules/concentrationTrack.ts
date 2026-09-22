import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		schools: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				// The object form renders the school's label rather than its raw id. Widened
				// because a GM can add schools of their own (see spellSchoolSettings).
				choices: () => CONFIG.NIMBLE.spellSchools as Record<string, string>,
			}),
			{
				required: true,
				nullable: false,
				initial: [],
				label: 'NIMBLE.rules.concentrationTrack.schools.label',
				hint: 'NIMBLE.rules.concentrationTrack.schools.hint',
			},
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'concentrationTrack',
		}),
	};
}

declare namespace ConcentrationTrackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActorSystem {
	system: {
		concentrationTracks?: Set<string>;
	};
}

/**
 * Rule that gives the named spell schools a concentration track of their own,
 * so casting in one of them leaves a concentration held in another alone.
 * Naming schools splits the caster's single concentration rather than adding
 * one, so the tracks are the whole of their capacity: see
 * `concentrationsEndedBy` for what a cast in an unnamed school displaces.
 *
 * Tracks are accumulated in a Set on the actor and read when an activated item
 * applies concentration.
 */
class ConcentrationTrackRule extends NimbleBaseRule<ConcentrationTrackRule.Schema> {
	static override group = 'conditions';
	static override description = 'NIMBLE.rules.concentrationTrack.description';

	declare schools: string[];

	static override defineSchema(): ConcentrationTrackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(new Map([['schools', 'string[]']]));
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;
		if (this.schools.length === 0) return;

		const { actor } = item;
		const actorSystem = actor as object as ActorSystem;

		if (!actorSystem.system.concentrationTracks) {
			foundry.utils.setProperty(actor.system, 'concentrationTracks', new Set<string>());
		}

		for (const school of this.schools) {
			actorSystem.system.concentrationTracks!.add(school);
		}
	}
}

export { ConcentrationTrackRule };
