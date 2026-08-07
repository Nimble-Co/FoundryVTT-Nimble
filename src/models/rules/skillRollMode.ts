import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			initial: 1,
			label: 'NIMBLE.rules.skillRollMode.value.label',
			hint: 'NIMBLE.rules.skillRollMode.value.hint',
		}),
		skills: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				// `'all'` is a runtime sentinel resolved in afterPrepareData to mean
				// "every skill". Must remain a valid choice.
				choices: () => [...Object.keys(CONFIG.NIMBLE.skills), 'all'],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.skillRollMode.skills.label',
				hint: 'NIMBLE.rules.skillRollMode.skills.hint',
			},
		),
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'adjust',
			label: 'NIMBLE.rules.skillRollMode.mode.label',
			hint: 'NIMBLE.rules.skillRollMode.mode.hint',
			choices: ['set', 'adjust'],
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'skillRollMode' }),
	};
}

declare namespace SkillRollModeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class SkillRollModeRule extends NimbleBaseRule<SkillRollModeRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.skillRollMode.description';

	declare value: number;
	declare skills: string[];
	// `mode` is inferred from the schema's `choices` (`'set' | 'adjust'`).
	// No explicit declare — the wider `string` would clash.

	static override defineSchema(): SkillRollModeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['skills', 'string[]'],
				['mode', '"set" | "adjust"'],
			]),
		);
	}

	override afterPrepareData(): void {
		const { item } = this;
		if (!item.isEmbedded) return;
		if (!this.test()) return;

		const { actor } = item;

		interface ActorSkills {
			skills?: Record<string, { defaultRollMode?: number }>;
		}
		const actorSystem = actor.system as object as ActorSkills;

		let { skills } = this;
		if (!skills.length) return;
		if (skills.includes('all')) skills = Object.keys(CONFIG.NIMBLE.skills);

		for (const skill of skills) {
			const currentRollMode = actorSystem.skills?.[skill]?.defaultRollMode;
			if (currentRollMode === undefined) continue;

			const newRollMode = this.mode === 'set' ? this.value : currentRollMode + this.value;
			foundry.utils.setProperty(actor.system, `skills.${skill}.defaultRollMode`, newRollMode);
		}
	}
}

export { SkillRollModeRule };
