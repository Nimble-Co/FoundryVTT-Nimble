import type { RuleFormGroup } from './_formLayout.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/** The events that can ask for the save. */
export const SAVE_ON_EVENTS = ['critReceived', 'takeDamage'] as const;
export type SaveOnEvent = (typeof SAVE_ON_EVENTS)[number];

function schema() {
	const { fields } = foundry.data;
	return {
		event: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'critReceived',
			choices: Object.fromEntries(
				SAVE_ON_EVENTS.map((event) => [event, `NIMBLE.rules.saveOnEvent.event.choices.${event}`]),
			),
			label: 'NIMBLE.rules.saveOnEvent.event.label',
			hint: 'NIMBLE.rules.saveOnEvent.event.hint',
		}),
		saveType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'strength',
			choices: () => CONFIG.NIMBLE.savingThrows,
			label: 'NIMBLE.rules.saveOnEvent.saveType.label',
			hint: 'NIMBLE.rules.saveOnEvent.saveType.hint',
		}),
		saveDC: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '10',
				label: 'NIMBLE.rules.saveOnEvent.saveDC.label',
				hint: 'NIMBLE.rules.saveOnEvent.saveDC.hint',
				widget: 'formula',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'saveOnEvent' }),
	};
}

declare namespace SaveOnEventRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * When the event happens to the creature, its owner rolls the save from a line on the card that
 * caused it. A failure ends the effect the rule is on, so the rule works only on an effect.
 */
class SaveOnEventRule extends NimbleBaseRule<SaveOnEventRule.Schema> {
	declare event: SaveOnEvent;
	declare saveType: keyof typeof CONFIG.NIMBLE.savingThrows;
	declare saveDC: string;

	static override worksOnItems = false;
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.saveOnEvent.description';
	static override icon = 'fa-solid fa-shield-heart';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['event', 'saveType', 'saveDC'] },
	];

	static override defineSchema(): SaveOnEventRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['event', 'string'],
				['saveType', 'string'],
				['saveDC', 'string'],
			]),
		);
	}

	/** The DC as a number, from the stats of the creature that holds the rule. */
	get dc(): number {
		const resolved = this.resolveFormula(this.saveDC?.trim() || '10');
		const value = resolved === null ? Number.NaN : Number(resolved);
		return Number.isFinite(value) ? value : 10;
	}

	override afterPrepareData(): void {
		if (this.isOnActor) this.checkReferences(this.saveDC);
	}
}

export { SaveOnEventRule };
