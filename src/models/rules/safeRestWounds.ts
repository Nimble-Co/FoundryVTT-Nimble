import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const MODES = ['add', 'multiply', 'replace', 'all'] as const;
type Mode = (typeof MODES)[number];

function schema() {
	const { fields } = foundry.data;
	return {
		mode: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'add',
			choices: Object.fromEntries(
				MODES.map((mode) => [mode, `NIMBLE.rules.safeRestWounds.mode.choices.${mode}`]),
			),
			label: 'NIMBLE.rules.safeRestWounds.mode.label',
			hint: 'NIMBLE.rules.safeRestWounds.mode.hint',
		}),
		value: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '0',
				label: 'NIMBLE.rules.safeRestWounds.value.label',
				hint: 'NIMBLE.rules.safeRestWounds.value.hint',
				widget: 'formula',
				showWhen: (data: Record<string, unknown>) => data.mode !== 'all',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'safeRestWounds' }),
	};
}

declare namespace SafeRestWoundsRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Changes the 1 Wound a safe rest heals. Rules run from lowest priority, each
 * seeing the number so far. `all` heals every current Wound.
 */
class SafeRestWoundsRule extends NimbleBaseRule<SafeRestWoundsRule.Schema> {
	declare mode: Mode;
	declare value: string;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.safeRestWounds.description';
	static override icon = 'fa-solid fa-bed';
	static override formLayout: readonly RuleFormGroup[] = [{ fields: ['mode', 'value'] }];

	static override defineSchema(): SafeRestWoundsRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['mode', 'string'],
				['value', 'string'],
			]),
		);
	}

	/** The next healed count, from the count the rules before this one left. */
	healOnSafeRest(soFar: number, current: number): number {
		if (this.mode === 'all') return current;
		const text = this.value?.trim() ?? '';
		const resolved = text ? this.resolveFormula(text) : 0;
		const value = resolved === null ? Number.NaN : Number(resolved);
		const amount = Number.isFinite(value) ? value : 0;
		if (this.mode === 'multiply') return soFar * amount;
		if (this.mode === 'replace') return amount;
		return soFar + amount;
	}
}

export { SafeRestWoundsRule };
