import { hasRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/** What a Max Damage rule gives max dice to. */
const MAX_DAMAGE_USES = ['damage', 'healing'] as const;
type MaxDamageUse = (typeof MAX_DAMAGE_USES)[number];

function schema() {
	const { fields } = foundry.data;
	const uses = (use: MaxDamageUse) => (data: Record<string, unknown>) =>
		(data.use ?? 'damage') === use;
	return {
		use: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'damage',
			choices: choiceLabels('maxDamage', 'use', MAX_DAMAGE_USES),
			label: 'NIMBLE.rules.maxDamage.use.label',
			hint: 'NIMBLE.rules.maxDamage.use.hint',
		}),
		schools: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: () => CONFIG.NIMBLE.spellSchools,
			}),
			withWidget({
				required: true,
				nullable: false,
				initial: [] as string[],
				label: 'NIMBLE.rules.maxDamage.schools.label',
				hint: 'NIMBLE.rules.maxDamage.schools.hint',
			}),
		),
		givesCrit: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.maxDamage.givesCrit.label',
				hint: 'NIMBLE.rules.maxDamage.givesCrit.hint',
				showWhen: uses('damage'),
			}),
		),
		tempHpChoice: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: 'NIMBLE.rules.maxDamage.tempHpChoice.label',
				hint: 'NIMBLE.rules.maxDamage.tempHpChoice.hint',
				showWhen: uses('healing'),
			}),
		),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: false,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.maxDamage.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.maxDamage.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		chargeCost: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 1,
				min: 1,
				integer: true,
				label: 'NIMBLE.rules.maxDamage.chargeCost.label',
				hint: 'NIMBLE.rules.maxDamage.chargeCost.hint',
				showWhen: (data: Record<string, unknown>) =>
					typeof data.chargePoolIdentifier === 'string' && data.chargePoolIdentifier.trim() !== '',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxDamage' }),
	};
}

declare namespace MaxDamageRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** The item a Max Damage rule is asked about, by what the roll window knows of it. */
interface MaxDamageItem {
	type?: string;
	system?: { school?: string };
}

/**
 * Lets a creature take the max of a roll in place of rolling it. It is a tick
 * in the roll window. Read when the window opens and when the roll is made,
 * never during data preparation.
 */
class MaxDamageRule extends NimbleBaseRule<MaxDamageRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.maxDamage.description';
	static override icon = 'fa-solid fa-angles-up';
	static override formLayout: readonly RuleFormGroup[] = [
		{ fields: ['use', 'schools'] },
		{ fields: ['givesCrit', 'tempHpChoice'] },
		{
			label: 'NIMBLE.rules.reroll.form.cost.label',
			hint: 'NIMBLE.rules.reroll.form.cost.hint',
			fields: ['chargePoolIdentifier', 'chargeCost'],
		},
	];

	declare use: MaxDamageUse;
	declare schools: (keyof typeof CONFIG.NIMBLE.spellSchools)[];
	declare givesCrit: boolean;
	declare tempHpChoice: boolean;
	declare chargePoolIdentifier: string;
	declare chargeCost: number;

	static override defineSchema(): MaxDamageRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['use', 'string'],
				['schools', 'string[]'],
				['givesCrit', 'boolean'],
				['tempHpChoice', 'boolean'],
				['chargePoolIdentifier', 'string'],
				['chargeCost', 'number'],
			]),
		);
	}

	/** Whether this rule covers rolls of `item`. Its uses left are read by `canPay`. */
	covers(item: MaxDamageItem): boolean {
		if (!this.isOnActor || !this.test()) return false;
		const schools = this.schools ?? [];
		if (schools.length < 1) return true;
		return item.type === 'spell' && (schools as string[]).includes(item.system?.school ?? '');
	}

	get canPay(): boolean {
		return hasRuleCharge(this.actor, this.chargePoolIdentifier ?? '', this.chargeCost);
	}
}

export { MAX_DAMAGE_USES, MaxDamageRule, type MaxDamageUse };
