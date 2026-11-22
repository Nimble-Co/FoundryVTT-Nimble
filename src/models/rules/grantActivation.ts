import { choiceLabels } from './_rollUseRule.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';

/**
 * The kinds of activation a recipient can be offered. A closed set so the
 * chat card knows how to build the recipient's item list.
 */
const GRANTED_ACTIVATION_TYPES = ['weaponAttack'] as const;

/** When the line goes on a card: the item is used, or its owner Interposes. */
const GRANTED_ACTIVATION_TRIGGERS = ['onActivation', 'onInterpose'] as const;

/** The weapons the recipient can attack with. */
const GRANTED_WEAPON_KINDS = ['any', 'melee', 'ranged', 'unarmed'] as const;

type GrantedActivationType = (typeof GRANTED_ACTIVATION_TYPES)[number];
type GrantedActivationTrigger = (typeof GRANTED_ACTIVATION_TRIGGERS)[number];
type GrantedWeaponKind = (typeof GRANTED_WEAPON_KINDS)[number];

const key = (field: string, part: 'label' | 'hint') =>
	`NIMBLE.rules.grantActivation.${field}.${part}`;

const flag = (field: string) =>
	new foundry.data.fields.BooleanField({
		required: true,
		nullable: false,
		initial: false,
		label: key(field, 'label'),
		hint: key(field, 'hint'),
	});

function schema() {
	const { fields } = foundry.data;

	return {
		activationType: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'weaponAttack',
			label: key('activationType', 'label'),
			hint: key('activationType', 'hint'),
			choices: [...GRANTED_ACTIVATION_TYPES],
		}),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'onActivation',
			label: key('trigger', 'label'),
			hint: key('trigger', 'hint'),
			choices: choiceLabels('grantActivation', 'trigger', GRANTED_ACTIVATION_TRIGGERS),
		}),
		includesUser: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: key('includesUser', 'label'),
				hint: key('includesUser', 'hint'),
				showWhen: (data: Record<string, unknown>) => data.trigger !== 'onInterpose',
			}),
		),
		includesTargets: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: true,
				label: key('includesTargets', 'label'),
				hint: key('includesTargets', 'hint'),
				showWhen: (data: Record<string, unknown>) => data.trigger !== 'onInterpose',
			}),
		),
		targetCount: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 0,
				label: key('targetCount', 'label'),
				hint: key('targetCount', 'hint'),
				showWhen: (data: Record<string, unknown>) =>
					data.trigger !== 'onInterpose' && data.includesTargets !== false,
			}),
		),
		weaponKind: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			label: key('weaponKind', 'label'),
			hint: key('weaponKind', 'hint'),
			choices: choiceLabels('grantActivation', 'weaponKind', GRANTED_WEAPON_KINDS),
		}),
		allowsCantrips: flag('allowsCantrips'),
		free: flag('free'),
		spendsReaction: flag('spendsReaction'),
		ignoresRushed: flag('ignoresRushed'),
		condition: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: key('condition', 'label'),
			hint: key('condition', 'hint'),
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantActivation' }),
	};
}

declare namespace GrantActivationRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Gives creatures an attack line on a chat card: when the owning item is used
 * (its user, the user's current targets, or both), or when the owner Interposes
 * (the owner). Carries no lifecycle hooks: the card code collects the rules and
 * stamps the lines, where the recipient's owner (or a GM) uses them.
 *
 * A line runs the recipient's normal activation. It spends an action unless
 * the rule makes it free or spends the reaction instead.
 */
class GrantActivationRule extends NimbleBaseRule<GrantActivationRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.grantActivation.description';
	static override icon = 'fa-solid fa-hand-point-right';

	declare activationType: GrantedActivationType;
	declare trigger: GrantedActivationTrigger;
	declare includesUser: boolean;
	declare includesTargets: boolean;
	declare targetCount: number;
	declare weaponKind: GrantedWeaponKind;
	declare allowsCantrips: boolean;
	declare free: boolean;
	declare spendsReaction: boolean;
	declare ignoresRushed: boolean;
	declare condition: string;

	static override defineSchema(): GrantActivationRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['activationType', '"weaponAttack"'],
				['trigger', '"onActivation" | "onInterpose"'],
				['includesUser', 'boolean'],
				['includesTargets', 'boolean'],
				['targetCount', 'number'],
				['weaponKind', GRANTED_WEAPON_KINDS.map((each) => `"${each}"`).join(' | ')],
				['allowsCantrips', 'boolean'],
				['free', 'boolean'],
				['spendsReaction', 'boolean'],
				['ignoresRushed', 'boolean'],
				['condition', 'string'],
			]),
		);
	}
}

export {
	GRANTED_WEAPON_KINDS,
	GrantActivationRule,
	type GrantedActivationTrigger,
	type GrantedActivationType,
	type GrantedWeaponKind,
};
