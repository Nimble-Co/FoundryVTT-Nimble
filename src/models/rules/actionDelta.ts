import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

type ActionDeltaTiming = 'now' | 'nextTurn';

type ActionDeltaTarget = 'self' | 'targeted' | 'allAllies';

/**
 * The change an `actionDelta` rule makes to a combatant's action pools when it
 * fires, expressed as a single combined adjustment: `currentDelta` applies to
 * the current pool immediately, `pendingDelta` accumulates into the amount
 * folded in at the recipient's next action refill.
 */
interface ActionDeltaApplication {
	currentDelta: number;
	pendingDelta: number;
}

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '1',
				label: 'NIMBLE.rules.actionDelta.value.label',
				hint: 'NIMBLE.rules.actionDelta.value.hint',
				widget: 'formula',
			}),
		),
		timing: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'now',
			label: 'NIMBLE.rules.actionDelta.timing.label',
			hint: 'NIMBLE.rules.actionDelta.timing.hint',
			choices: ['now', 'nextTurn'],
		}),
		target: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'self',
			label: 'NIMBLE.rules.actionDelta.target.label',
			hint: 'NIMBLE.rules.actionDelta.target.hint',
			choices: ['self', 'targeted', 'allAllies'],
		}),
		borrowFromNextTurn: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.actionDelta.borrowFromNextTurn.label',
			hint: 'NIMBLE.rules.actionDelta.borrowFromNextTurn.hint',
			showWhen: (data: Record<string, unknown>) => data.timing !== 'nextTurn',
		} as unknown as never),
		type: new fields.StringField({ required: true, nullable: false, initial: 'actionDelta' }),
	};
}

declare namespace ActionDeltaRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Grants (or removes) raw actions when the owning item is used. Carries no
 * lifecycle hooks — the item-use hook (`src/hooks/actionEconomySystem.ts`)
 * collects matching rules and applies their resolved deltas to the affected
 * character combatants.
 *
 * `timing` picks when the change lands: `now` adjusts the current action pool
 * immediately (overflow past the pool maximum is allowed), `nextTurn`
 * accumulates into the pending adjustment folded in at the recipient's next
 * refill. `borrowFromNextTurn` combines the two: gain the value now and start
 * the next turn with that many fewer, as one atomic adjustment. `target` picks
 * who is affected — the activating actor, the user's current targets, or every
 * allied character combatant.
 */
class ActionDeltaRule extends NimbleBaseRule<ActionDeltaRule.Schema> {
	static override group = 'resource';
	static override description = 'NIMBLE.rules.actionDelta.description';

	declare value: string;

	declare timing: ActionDeltaTiming;

	declare target: ActionDeltaTarget;

	declare borrowFromNextTurn: boolean;

	static override defineSchema(): ActionDeltaRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['timing', '"now" | "nextTurn"'],
				['target', '"self" | "targeted" | "allAllies"'],
				['borrowFromNextTurn', 'boolean'],
			]),
		);
	}

	/** Resolves the configured value against the actor's roll data. */
	resolveValue(): number | null {
		return this.resolveFormula(this.value);
	}

	/**
	 * The combined current/pending adjustment this rule makes when it fires, or
	 * `null` when the resolved value is invalid or zero (a no-op).
	 */
	resolveApplication(): ActionDeltaApplication | null {
		const value = this.resolveValue();
		if (value === null) return null;
		const normalizedValue = Math.trunc(value);
		if (normalizedValue === 0) return null;

		if (this.timing === 'nextTurn') {
			return { currentDelta: 0, pendingDelta: normalizedValue };
		}

		return {
			currentDelta: normalizedValue,
			pendingDelta: this.borrowFromNextTurn ? -normalizedValue : 0,
		};
	}
}

export { ActionDeltaRule, type ActionDeltaApplication };
