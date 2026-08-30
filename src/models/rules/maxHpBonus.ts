import { NimbleBaseRule } from './base.js';

// Dedupe the phase-mismatch warning by item and rule so it fires once per
// session rather than on every prepare cycle. Bounded by authored content.
const warnedPhaseMismatchRules = new Set<string>();

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			label: 'NIMBLE.rules.maxHpBonus.value.label',
			hint: 'NIMBLE.rules.maxHpBonus.value.hint',
		}),
		perLevel: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.maxHpBonus.perLevel.label',
			hint: 'NIMBLE.rules.maxHpBonus.perLevel.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxHpBonus' }),
	};
}

declare namespace MaxHpBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxHpBonusRule extends NimbleBaseRule<MaxHpBonusRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.maxHpBonus.description';

	// The base class infers this from the presence of a `prePrepareData` method.
	// This rule has none, but is read even earlier than that sweep, so it needs
	// the early-phase predicate guardrails all the same.
	static override get appliesInPrePrepareData(): boolean {
		return true;
	}

	declare value: number;
	declare perLevel: boolean;

	static override defineSchema(): MaxHpBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['perLevel', 'boolean'],
			]),
		);
	}

	/**
	 * The max-HP this rule currently contributes. Resolved on demand rather than
	 * banked into the stored `attributes.hp.bonus`, where it went stale as soon
	 * as anything the formula reads changed and could not be reconciled after
	 * the fact.
	 */
	resolvedBonus(): number {
		const { item } = this;
		if (!item?.isEmbedded) return 0;

		if (!this.test()) {
			this.#rejectedInEarlyPass = true;
			return 0;
		}
		this.#rejectedInEarlyPass = false;

		const formula = this.perLevel ? `${this.value} * @level` : `${this.value}`;

		return this.resolveFormula(formula) ?? 0;
	}

	/** Whether the predicate failed the last time max HP was computed. */
	#rejectedInEarlyPass = false;

	/**
	 * `resolvedBonus()` runs before `_populateDerivedTags()`, so it only ever sees
	 * the actor's base tags and the carrying item's own tags. A predicate on
	 * anything the actor derives later (`class:`, `level:`, `subclass:`,
	 * `ancestry:`, `self:`) silently fails there and the rule contributes nothing,
	 * while the same predicate reads as matching everywhere else in the UI.
	 *
	 * Re-testing here, once the domain is complete, catches exactly that case: the
	 * predicate that passes now but failed then. Comparing the two answers beats
	 * warning on a list of tag prefixes, which cannot tell an actor's `class:`
	 * tag apart from the identical one a feature item carries.
	 */
	override afterPrepareData(): void {
		if (!this.#rejectedInEarlyPass) return;
		if (!this.predicate.size) return;

		const { item } = this;
		if (!item?.isEmbedded) return;
		if (!this.test()) return;

		const dedupeKey = `${item.uuid}:${this.id}`;
		if (warnedPhaseMismatchRules.has(dedupeKey)) return;
		warnedPhaseMismatchRules.add(dedupeKey);

		console.warn(
			`Nimble | maxHpBonus rule "${this.label || this.id}" on "${item.name}" predicates on tags ` +
				'that are computed after max HP, so it added nothing. Max HP is calculated before the ' +
				"actor's class, level, subclass, ancestry and self: tags exist; only size, disposition " +
				"and the item's own tags can be tested by this rule.",
		);
	}
}

export { MaxHpBonusRule };
