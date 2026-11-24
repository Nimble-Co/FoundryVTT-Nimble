import type { PendingWoundPlan, PendingWoundView } from '#utils/wounds/pendingWound.js';
import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const CHANGES = ['negate', 'lower', 'set', 'redirect'] as const;
const CHOICES = ['automatic', 'offer'] as const;
const CAUSES = ['any', 'direct', 'dropToZero', 'dyingDamage', 'redirect'] as const;
const CRITICALS = ['any', 'only', 'never'] as const;
const WATCHES = ['self', 'allies'] as const;
const REDIRECTS = ['source', 'watcher'] as const;

type Change = (typeof CHANGES)[number];
type Choice = (typeof CHOICES)[number];
type Cause = (typeof CAUSES)[number];
type Critical = (typeof CRITICALS)[number];
type Watch = (typeof WATCHES)[number];
type RedirectTo = (typeof REDIRECTS)[number];

function choiceKeys(group: string, values: readonly string[]) {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.pendingWound.${group}.choices.${value}`]),
	);
}

function schema() {
	const { fields } = foundry.data;
	return {
		change: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'negate',
			choices: choiceKeys('change', CHANGES),
			label: 'NIMBLE.rules.pendingWound.change.label',
			hint: 'NIMBLE.rules.pendingWound.change.hint',
		}),
		amount: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.pendingWound.amount.label',
				hint: 'NIMBLE.rules.pendingWound.amount.hint',
				widget: 'formula',
			}),
		),
		whenAmount: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 0,
			label: 'NIMBLE.rules.pendingWound.whenAmount.label',
			hint: 'NIMBLE.rules.pendingWound.whenAmount.hint',
		}),
		choice: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'automatic',
			choices: choiceKeys('choice', CHOICES),
			label: 'NIMBLE.rules.pendingWound.choice.label',
			hint: 'NIMBLE.rules.pendingWound.choice.hint',
		}),
		cause: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceKeys('cause', CAUSES),
			label: 'NIMBLE.rules.pendingWound.cause.label',
			hint: 'NIMBLE.rules.pendingWound.cause.hint',
		}),
		critical: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceKeys('critical', CRITICALS),
			label: 'NIMBLE.rules.pendingWound.critical.label',
			hint: 'NIMBLE.rules.pendingWound.critical.hint',
		}),
		onlyLastWound: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.pendingWound.onlyLastWound.label',
			hint: 'NIMBLE.rules.pendingWound.onlyLastWound.hint',
		}),
		watch: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'self',
			choices: choiceKeys('watch', WATCHES),
			label: 'NIMBLE.rules.pendingWound.watch.label',
			hint: 'NIMBLE.rules.pendingWound.watch.hint',
		}),
		reach: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 0,
				label: 'NIMBLE.rules.pendingWound.reach.label',
				hint: 'NIMBLE.rules.pendingWound.reach.hint',
				showWhen: (data: Record<string, unknown>) => data.watch === 'allies',
			}),
		),
		redirectTo: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'source',
				choices: choiceKeys('redirectTo', REDIRECTS),
				label: 'NIMBLE.rules.pendingWound.redirectTo.label',
				hint: 'NIMBLE.rules.pendingWound.redirectTo.hint',
				showWhen: (data: Record<string, unknown>) => data.change === 'redirect',
			}),
		),
		moveDistance: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.pendingWound.moveDistance.label',
				hint: 'NIMBLE.rules.pendingWound.moveDistance.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'pendingWound' }),
	};
}

declare namespace PendingWoundRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Changes a Wound before it is written. Read by `alterPendingWound`. A blank
 * amount negates or redirects every pending Wound. A blank lower covers none.
 * A blank set makes the pending number 0, and that is not a negation.
 */
class PendingWoundRule extends NimbleBaseRule<PendingWoundRule.Schema> {
	declare change: Change;
	declare amount: string;
	declare whenAmount: number;
	declare choice: Choice;
	declare cause: Cause;
	declare critical: Critical;
	declare onlyLastWound: boolean;
	declare watch: Watch;
	declare reach: number;
	declare redirectTo: RedirectTo;
	declare moveDistance: string;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.pendingWound.description';
	static override icon = 'fa-solid fa-droplet';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['change', 'amount', 'whenAmount', 'choice'] },
		{ fields: ['cause', 'critical', 'onlyLastWound'] },
		{ fields: ['watch', 'reach', 'redirectTo', 'moveDistance'] },
	];

	static override defineSchema(): PendingWoundRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['change', 'string'],
				['amount', 'string'],
				['whenAmount', 'number'],
				['choice', 'string'],
				['cause', 'string'],
				['critical', 'string'],
				['onlyLastWound', 'boolean'],
				['watch', 'string'],
				['reach', 'number'],
				['redirectTo', 'string'],
				['moveDistance', 'string'],
			]),
		);
	}

	matchesPending(view: PendingWoundView): boolean {
		if (!this.appliesTo()) return false;
		if (!(view.amount > 0)) return false;
		if (this.cause !== 'any' && this.cause !== view.cause) return false;
		if (this.critical === 'only' && !view.critical) return false;
		if (this.critical === 'never' && view.critical) return false;
		if (this.whenAmount > 0 && view.amount !== this.whenAmount) return false;
		if (this.onlyLastWound && !view.reachesLastWound) return false;
		return true;
	}

	planPending(_view: PendingWoundView, mover?: unknown): PendingWoundPlan {
		return {
			change: this.change,
			take: this.#take(),
			redirectTo: this.redirectTo,
			moveDistance: this.resolveMoveSpaces(this.moveDistance, mover),
		};
	}

	#take(): number {
		const formula = this.amount?.trim() ?? '';
		if (!formula) {
			return this.change === 'lower' || this.change === 'set' ? 0 : Number.POSITIVE_INFINITY;
		}
		return this.#count(formula);
	}

	#count(formula: string): number {
		const text = formula?.trim() ?? '';
		if (!text) return 0;
		const resolved = this.resolveFormula(text);
		const value = resolved === null ? Number.NaN : Math.floor(Number(resolved));
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	}
}

export { PendingWoundRule };
