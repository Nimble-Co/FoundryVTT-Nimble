import {
	ATTACK_DELIVERY_FILTERS,
	type AttackDelivery,
	type AttackDeliveryFilter,
	matchesAttackDelivery,
} from '../../utils/damage/attackDelivery.js';
import type { RuleFormGroup } from './_formLayout.js';
import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const TRIGGER_CHOICES = ['damaged', 'attacked', 'tempHpReduced'] as const;
const AMOUNT_CHOICES = ['taken', 'critDice', 'formula', 'none'] as const;

type DamageBackTrigger = (typeof TRIGGER_CHOICES)[number];
type DamageBackAmount = (typeof AMOUNT_CHOICES)[number];

const key = (field: string, part: 'label' | 'hint') => `NIMBLE.rules.damageBack.${field}.${part}`;
const triggerOf = (data: Record<string, unknown>) => (data.trigger ?? 'damaged') as string;
const dealsDamage = (data: Record<string, unknown>) => data.amount !== 'none';

function schema() {
	const { fields } = foundry.data;

	return {
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'damaged',
			choices: choiceLabels('damageBack', 'trigger', TRIGGER_CHOICES),
			label: key('trigger', 'label'),
			hint: key('trigger', 'hint'),
		}),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
			label: key('attackDelivery', 'label'),
			hint: key('attackDelivery', 'hint'),
		}),
		notOnAllies: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: key('notOnAllies', 'label'),
			hint: key('notOnAllies', 'hint'),
		}),
		onlyCrits: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: true,
				label: key('onlyCrits', 'label'),
				hint: key('onlyCrits', 'hint'),
				showWhen: (data: Record<string, unknown>) => triggerOf(data) !== 'attacked',
			}),
		),
		answeredAttack: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('answeredAttack', 'label'),
				hint: key('answeredAttack', 'hint'),
				showWhen: (data: Record<string, unknown>) => triggerOf(data) === 'attacked',
			}),
		),
		amount: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'taken',
			choices: choiceLabels('damageBack', 'amount', AMOUNT_CHOICES),
			label: key('amount', 'label'),
			hint: key('amount', 'hint'),
		}),
		formula: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: key('formula', 'label'),
				hint: key('formula', 'hint'),
				widget: 'diceFormula',
				showWhen: (data: Record<string, unknown>) => data.amount === 'formula',
			}),
		),
		damageType: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: key('damageType', 'label'),
				hint: key('damageType', 'hint'),
				choices: () => CONFIG.NIMBLE.damageTypes,
				showWhen: (data: Record<string, unknown>) => data.amount === 'formula',
			}),
		),
		ignoreArmor: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: true,
				label: key('ignoreArmor', 'label'),
				hint: key('ignoreArmor', 'hint'),
				showWhen: dealsDamage,
			}),
		),
		woundDoubles: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('woundDoubles', 'label'),
				hint: key('woundDoubles', 'hint'),
				showWhen: dealsDamage,
			}),
		),
		attackerEffectId: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: key('attackerEffectId', 'label'),
				hint: key('attackerEffectId', 'hint'),
				widget: 'itemEffectPicker',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'damageBack' }),
	};
}

declare namespace DamageBackRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** What the rule reads of an attack: the event, whether it is a crit, and how it reached. */
interface AnsweredAttack {
	trigger?: DamageBackTrigger;
	isCritical: boolean;
	delivery?: AttackDelivery;
}

/**
 * The one who attacks the owner takes damage and/or gets an effect: when the owner takes damage
 * from the attack, when the owner is attacked, or when the attack takes the temp HP of the
 * effect that holds the rule. Read on the GM client.
 */
class DamageBackRule extends NimbleBaseRule<DamageBackRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.damageBack.description';

	static override formLayout: readonly RuleFormGroup[] = [
		{
			label: key('whenGroup', 'label'),
			fields: ['trigger', 'attackDelivery', 'notOnAllies', 'onlyCrits', 'answeredAttack'],
		},
		{
			label: key('damageGroup', 'label'),
			fields: ['amount', 'formula', 'damageType', 'ignoreArmor', 'woundDoubles'],
		},
		{ label: key('effectGroup', 'label'), fields: ['attackerEffectId'] },
	];

	declare trigger: DamageBackTrigger;
	declare attackDelivery: AttackDeliveryFilter;
	declare notOnAllies: boolean;
	declare onlyCrits: boolean;
	declare answeredAttack: boolean;
	declare amount: DamageBackAmount;
	declare formula: string;
	declare ignoreArmor: boolean;
	declare woundDoubles: boolean;
	declare attackerEffectId: string;

	static override defineSchema(): DamageBackRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['trigger', 'string'],
				['attackDelivery', 'string'],
				['onlyCrits', 'boolean'],
				['amount', 'string'],
				['formula', 'string'],
				['attackerEffectId', 'string'],
			]),
		);
	}

	/** Whether the rule answers this event of an attack. A crit counts only for damage. */
	answersAttack(attack: AnsweredAttack): boolean {
		if (!this.isOnActor || !this.test()) return false;
		const trigger = this.trigger ?? 'damaged';
		if ((attack.trigger ?? 'damaged') !== trigger) return false;
		if (!matchesAttackDelivery(this.attackDelivery, attack.delivery ?? null)) return false;
		return trigger === 'attacked' || !this.onlyCrits || attack.isCritical;
	}
}

export { DamageBackRule, type DamageBackAmount, type DamageBackTrigger };
