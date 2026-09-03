import type { RollDialogType } from '#types/components/CheckRollDialog.d.ts';
import { NimbleBaseRule } from './base.js';

/** Sentinel accepted by every target list, meaning "every key of that kind". */
const ALL_TARGETS = 'all';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			initial: 1,
			label: 'NIMBLE.rules.situationalRollMode.value.label',
			hint: 'NIMBLE.rules.situationalRollMode.value.hint',
		}),
		checkType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'savingThrow',
			label: 'NIMBLE.rules.situationalRollMode.checkType.label',
			hint: 'NIMBLE.rules.situationalRollMode.checkType.hint',
			choices: () => CONFIG.NIMBLE.rollCheckTypes,
		}),
		saves: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				choices: () => [...Object.keys(CONFIG.NIMBLE.savingThrows), ALL_TARGETS],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.situationalRollMode.saves.label',
				hint: 'NIMBLE.rules.situationalRollMode.saves.hint',
				showWhen: (data) => data.checkType === 'savingThrow',
			} as unknown as never,
		),
		abilities: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				choices: () => [...Object.keys(CONFIG.NIMBLE.abilities), ALL_TARGETS],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.situationalRollMode.abilities.label',
				hint: 'NIMBLE.rules.situationalRollMode.abilities.hint',
				showWhen: (data) => data.checkType === 'abilityCheck',
			} as unknown as never,
		),
		skills: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				initial: '',
				choices: () => [...Object.keys(CONFIG.NIMBLE.skills), ALL_TARGETS],
			}),
			{
				required: true,
				nullable: false,
				label: 'NIMBLE.rules.situationalRollMode.skills.label',
				hint: 'NIMBLE.rules.situationalRollMode.skills.hint',
				showWhen: (data) => data.checkType === 'skillCheck',
			} as unknown as never,
		),
		type: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'situationalRollMode',
		}),
	};
}

declare namespace SituationalRollModeRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Offers a roll mode adjustment the roller opts into when the situation calls for it,
 * for circumstances the system cannot detect on its own: "advantage against fear",
 * "advantage on Stealth checks in natural terrain", "disadvantage while blinded".
 *
 * Unlike `savingThrowRollMode` / `skillRollMode` / `initiativeRollMode`, which bake
 * their value into the actor's default roll mode, this rule changes nothing until the
 * roller checks it. The check roll dialog lists every offered adjustment whose
 * predicate passes and whose check type and target key match the roll being made, and
 * folds the checked ones into that roll only.
 *
 * The `predicate` still gates whether the option is offered at all, so state the
 * system does know about (bloodied, unarmored, raging) belongs there rather than in
 * the label. The label describes only what the system cannot know.
 *
 * Attack rolls are not covered: they go through the item activation dialog, where
 * `conditionalBonus` already offers a per-attack choice.
 */
class SituationalRollModeRule extends NimbleBaseRule<SituationalRollModeRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.situationalRollMode.description';

	declare value: number;
	declare saves: string[];
	declare abilities: string[];
	declare skills: string[];
	// `checkType` is inferred from the schema's `choices` (the roll-check-type keys);
	// re-declaring it as the wider `string` would clash with that type.

	static override defineSchema(): SituationalRollModeRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['checkType', 'string'],
				['saves', 'string[]'],
				['abilities', 'string[]'],
				['skills', 'string[]'],
			]),
		);
	}

	/**
	 * The image the check roll dialog shows beside this option: the owning item's own
	 * artwork, so the option is recognisable as the feature that granted it and no
	 * second icon has to be authored or kept in sync.
	 */
	iconPath(): string {
		return this.item?.img ?? '';
	}

	/** A zero adjustment would render a toggle that does nothing. */
	offersAdjustment(): boolean {
		return this.value !== 0;
	}

	/**
	 * Whether this option belongs on the dialog for a given roll. `targetKey` is the
	 * save, ability, or skill being rolled, and is ignored for initiative.
	 */
	matchesRoll(checkType: RollDialogType, targetKey: string | undefined): boolean {
		if (this.checkType !== checkType) return false;

		switch (checkType) {
			case 'savingThrow':
				return this.#matchesTargetKey(this.saves, targetKey);
			case 'abilityCheck':
				return this.#matchesTargetKey(this.abilities, targetKey);
			case 'skillCheck':
				return this.#matchesTargetKey(this.skills, targetKey);
			case 'initiative':
				return true;
			default:
				return false;
		}
	}

	#matchesTargetKey(targets: string[], targetKey: string | undefined): boolean {
		if (targets.includes(ALL_TARGETS)) return true;
		if (!targetKey) return false;
		return targets.includes(targetKey);
	}
}

export { SituationalRollModeRule };
