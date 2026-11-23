import type { WouldDropPlan } from '#utils/wounds/wouldDropToZero.js';
import { hasRuleCharge, spendRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const RESPONSES = ['prevent', 'floor'] as const;
const CHOICES = ['automatic', 'offer'] as const;
const WATCHES = ['self', 'allies'] as const;
const DIRECTIONS = ['any', 'away'] as const;

type Response = (typeof RESPONSES)[number];
type Choice = (typeof CHOICES)[number];
type Watch = (typeof WATCHES)[number];
type Direction = (typeof DIRECTIONS)[number];

function choiceKeys(group: string, values: readonly string[]) {
	return Object.fromEntries(
		values.map((value) => [value, `NIMBLE.rules.wouldDropToZero.${group}.choices.${value}`]),
	);
}

function schema() {
	const { fields } = foundry.data;
	return {
		response: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'prevent',
			choices: choiceKeys('response', RESPONSES),
			label: 'NIMBLE.rules.wouldDropToZero.response.label',
			hint: 'NIMBLE.rules.wouldDropToZero.response.hint',
		}),
		choice: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'automatic',
			choices: choiceKeys('choice', CHOICES),
			label: 'NIMBLE.rules.wouldDropToZero.choice.label',
			hint: 'NIMBLE.rules.wouldDropToZero.choice.hint',
		}),
		woundInstead: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.wouldDropToZero.woundInstead.label',
				hint: 'NIMBLE.rules.wouldDropToZero.woundInstead.hint',
				widget: 'formula',
			}),
		),
		moveDistance: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.wouldDropToZero.moveDistance.label',
				hint: 'NIMBLE.rules.wouldDropToZero.moveDistance.hint',
				widget: 'formula',
			}),
		),
		moveDirection: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceKeys('moveDirection', DIRECTIONS),
			label: 'NIMBLE.rules.wouldDropToZero.moveDirection.label',
			hint: 'NIMBLE.rules.wouldDropToZero.moveDirection.hint',
		}),
		onlyAttack: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.wouldDropToZero.onlyAttack.label',
			hint: 'NIMBLE.rules.wouldDropToZero.onlyAttack.hint',
		}),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.wouldDropToZero.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.wouldDropToZero.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		watch: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'self',
			choices: choiceKeys('watch', WATCHES),
			label: 'NIMBLE.rules.wouldDropToZero.watch.label',
			hint: 'NIMBLE.rules.wouldDropToZero.watch.hint',
		}),
		reach: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 0,
				label: 'NIMBLE.rules.wouldDropToZero.reach.label',
				hint: 'NIMBLE.rules.wouldDropToZero.reach.hint',
				showWhen: (data: Record<string, unknown>) => data.watch === 'allies',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'wouldDropToZero' }),
	};
}

declare namespace WouldDropToZeroRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Read when HP would fall from above 0 to 0. The first automatic match wins.
 * Preventing the drop also prevents the Wound that drop would cause.
 */
class WouldDropToZeroRule extends NimbleBaseRule<WouldDropToZeroRule.Schema> {
	declare response: Response;
	declare choice: Choice;
	declare woundInstead: string;
	declare moveDistance: string;
	declare moveDirection: Direction;
	declare onlyAttack: boolean;
	declare chargePoolIdentifier: string;
	declare watch: Watch;
	declare reach: number;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.wouldDropToZero.description';
	static override icon = 'fa-solid fa-heart-pulse';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['response', 'choice', 'woundInstead', 'chargePoolIdentifier'] },
		{ fields: ['watch', 'reach', 'moveDistance', 'moveDirection', 'onlyAttack'] },
	];

	static override defineSchema(): WouldDropToZeroRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['response', 'string'],
				['choice', 'string'],
				['woundInstead', 'string'],
				['moveDistance', 'string'],
				['moveDirection', 'string'],
				['onlyAttack', 'boolean'],
				['chargePoolIdentifier', 'string'],
				['watch', 'string'],
				['reach', 'number'],
			]),
		);
	}

	matchesDrop(request?: { attack?: boolean }): boolean {
		if (!this.appliesTo()) return false;
		if (this.onlyAttack && !request?.attack) return false;
		const pool = this.chargePoolIdentifier?.trim() ?? '';
		if (pool && !hasRuleCharge(this.actor, pool)) return false;
		return true;
	}

	async commitDrop(): Promise<void> {
		await spendRuleCharge(this.actor, this.chargePoolIdentifier ?? '');
	}

	planDrop(mover?: unknown): WouldDropPlan {
		return {
			response: this.response,
			woundInstead: this.#count(this.woundInstead),
			moveDistance: this.resolveMoveSpaces(this.moveDistance, mover),
			moveDirection: this.moveDirection === 'away' ? 'away' : 'any',
		};
	}

	#count(formula: string): number {
		const text = formula?.trim() ?? '';
		if (!text) return 0;
		const resolved = this.resolveFormula(text);
		const value = resolved === null ? Number.NaN : Math.floor(Number(resolved));
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	}
}

export { WouldDropToZeroRule };
