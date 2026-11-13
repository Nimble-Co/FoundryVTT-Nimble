import type { UseCost } from '#types/useCost.d.ts';
import type { Predicate } from '../../etc/Predicate.js';
import {
	ATTACK_DELIVERY_FILTERS,
	type AttackDeliveryFilter,
} from '../../utils/damage/attackDelivery.js';
import { PredicateField } from '../fields/PredicateField.js';
import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

const DEFEND_OPTION_WAYS = ['withDefend', 'freeDefend', 'extraDefend', 'allyDefends'] as const;
const DEFEND_OPTION_OUTCOMES = ['none', 'miss', 'noDamage', 'halve'] as const;

type DefendOptionWay = (typeof DEFEND_OPTION_WAYS)[number];
type DefendOptionOutcome = (typeof DEFEND_OPTION_OUTCOMES)[number];

const key = (field: string, part: 'label' | 'hint') => `NIMBLE.rules.defendOption.${field}.${part}`;
const isWay =
	(...ways: DefendOptionWay[]) =>
	(data: Record<string, unknown>) =>
		ways.includes(data.way as DefendOptionWay);
const onOwnDefend = isWay('withDefend', 'freeDefend', 'extraDefend');

function schema() {
	const { fields } = foundry.data;
	return {
		way: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'withDefend',
			choices: choiceLabels('defendOption', 'way', DEFEND_OPTION_WAYS),
			label: key('way', 'label'),
			hint: key('way', 'hint'),
		}),
		attackDelivery: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: choiceLabels('reroll', 'attackDelivery', ATTACK_DELIVERY_FILTERS),
			label: key('attackDelivery', 'label'),
			hint: key('attackDelivery', 'hint'),
		}),
		otherCreature: new PredicateField({
			label: key('otherCreature', 'label'),
			hint: key('otherCreature', 'hint'),
		}),
		outcome: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'none',
				choices: choiceLabels('defendOption', 'outcome', DEFEND_OPTION_OUTCOMES),
				label: key('outcome', 'label'),
				hint: key('outcome', 'hint'),
				showWhen: onOwnDefend,
			}),
		),
		armorBonus: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: key('armorBonus', 'label'),
				hint: key('armorBonus', 'hint'),
				showWhen: onOwnDefend,
			}),
		),
		useReroll: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('useReroll', 'label'),
				hint: key('useReroll', 'hint'),
				showWhen: onOwnDefend,
			}),
		),
		alsoInterpose: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('alsoInterpose', 'label'),
				hint: key('alsoInterpose', 'hint'),
				showWhen: isWay('withDefend'),
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
		reminder: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: key('reminder', 'label'),
			hint: key('reminder', 'hint'),
		}),
		useItem: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('useItem', 'label'),
				hint: key('useItem', 'hint'),
				showWhen: isWay('freeDefend'),
			}),
		),
		upcastArmor: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: 0,
				integer: true,
				label: key('upcastArmor', 'label'),
				hint: key('upcastArmor', 'hint'),
				showWhen: (data: Record<string, unknown>) =>
					data.way === 'freeDefend' && data.useItem === true,
			}),
		),
		withInterpose: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('withInterpose', 'label'),
				hint: key('withInterpose', 'hint'),
				showWhen: isWay('freeDefend', 'withDefend'),
			}),
		),
		wholeRound: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('wholeRound', 'label'),
				hint: key('wholeRound', 'hint'),
				showWhen: isWay('withDefend', 'freeDefend'),
			}),
		),
		range: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '2',
				label: key('range', 'label'),
				hint: key('range', 'hint'),
				widget: 'formula',
				showWhen: isWay('allyDefends'),
			}),
		),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: false,
				nullable: false,
				initial: '',
				label: key('chargePoolIdentifier', 'label'),
				hint: key('chargePoolIdentifier', 'hint'),
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
				label: key('chargeCost', 'label'),
				hint: key('chargeCost', 'hint'),
				showWhen: (data: Record<string, unknown>) =>
					typeof data.chargePoolIdentifier === 'string' && data.chargePoolIdentifier.trim() !== '',
			}),
		),
		dicePoolIdentifier: new fields.StringField(
			withWidget({
				required: false,
				nullable: false,
				initial: '',
				label: key('dicePoolIdentifier', 'label'),
				hint: key('dicePoolIdentifier', 'hint'),
				widget: 'dicePoolPicker',
			}),
		),
		actionCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: key('actionCost', 'label'),
			hint: key('actionCost', 'hint'),
		}),
		oncePerTurn: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: key('oncePerTurn', 'label'),
			hint: key('oncePerTurn', 'hint'),
		}),
		manaCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: key('manaCost', 'label'),
			hint: key('manaCost', 'hint'),
		}),
		woundCost: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: key('woundCost', 'label'),
			hint: key('woundCost', 'hint'),
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'defendOption' }),
	};
}

declare namespace DefendOptionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Something a hero can do with a Defend: a tick under the Defend row, a row
 * that Defends with no action, a second Defend in a round, or a button when an
 * ally Defends. Read by the Defend window when it opens.
 */
class DefendOptionRule extends NimbleBaseRule<DefendOptionRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.defendOption.description';

	declare way: DefendOptionWay;
	declare attackDelivery: AttackDeliveryFilter;
	declare otherCreature: Predicate;
	declare outcome: DefendOptionOutcome;
	declare armorBonus: string;
	declare useReroll: boolean;
	declare alsoInterpose: boolean;
	declare attackerEffectId: string;
	declare reminder: string;
	declare useItem: boolean;
	declare upcastArmor: number;
	declare withInterpose: boolean;
	declare wholeRound: boolean;
	declare range: string;
	declare chargePoolIdentifier: string;
	declare chargeCost: number;
	declare dicePoolIdentifier: string;
	declare actionCost: number;
	declare oncePerTurn: boolean;
	declare manaCost: number;
	declare woundCost: number;

	static override defineSchema(): DefendOptionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	/** What one use costs. No heroic reaction: the Defend pays for itself. */
	get optionCost(): UseCost {
		return {
			chargePoolIdentifier: this.chargePoolIdentifier ?? '',
			chargeCost: Math.max(1, Number(this.chargeCost) || 1),
			dicePoolIdentifier: this.dicePoolIdentifier ?? '',
			manaCost: Math.max(0, Number(this.manaCost) || 0),
			woundCost: Math.max(0, Number(this.woundCost) || 0),
			actionCost: Math.max(0, Number(this.actionCost) || 0),
			heroicReaction: '',
			// One turn use for every option of the item, as a feature's 1/turn reads.
			...(this.oncePerTurn ? { turnUseKey: `${this.parentDocument.uuid ?? ''}:defendOption` } : {}),
		};
	}

	/** The extra armor this Defend gets, or 0. */
	resolveArmorBonus(): number {
		const formula = (this.armorBonus ?? '').trim();
		if (!formula) return 0;
		const value = Number(this.resolveFormula(formula));
		return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
	}

	/** The spaces from the ally who Defends, from the formula; at least 1. */
	resolveRange(): number {
		return this.resolveSpaces(this.range, 1);
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['way', 'string'],
				['outcome', 'string'],
				['armorBonus', 'string'],
				['reminder', 'string'],
			]),
		);
	}
}

export { DEFEND_OPTION_OUTCOMES, DefendOptionRule, type DefendOptionOutcome, type DefendOptionWay };
