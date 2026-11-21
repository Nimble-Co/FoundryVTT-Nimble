import type { ActionCostChange, CostChange } from '#types/useOption.d.ts';
import { ruleKey } from '#utils/actor/actorRules.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import { readsCastMana } from '#utils/cost/castManaCost.js';
import { withWidget } from './_widgetOption.js';
import { NimbleBaseRule } from './base.js';
import { ResourceCostRule, resourceCostFields } from './resourceCost.js';

const WORDS = 'NIMBLE.rules.useOption';

/** What an option goes into the dialog of. */
const USE_OPTION_TARGETS = ['spell'] as const;
type UseOptionTarget = (typeof USE_OPTION_TARGETS)[number];

const forSpells = (data: Record<string, unknown>) => (data.target ?? 'spell') === 'spell';

function schema() {
	const { fields } = foundry.data;

	return {
		target: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'spell',
			label: `${WORDS}.target.label`,
			hint: `${WORDS}.target.hint`,
			choices: () =>
				Object.fromEntries(
					USE_OPTION_TARGETS.map((target) => [target, `${WORDS}.target.choices.${target}`]),
				),
		}),
		tieredOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: `${WORDS}.tieredOnly.label`,
				hint: `${WORDS}.tieredOnly.hint`,
				showWhen: forSpells,
			}),
		),
		singleTargetOnly: new fields.BooleanField(
			withWidget({
				required: true,
				nullable: false,
				initial: false,
				label: `${WORDS}.singleTargetOnly.label`,
				hint: `${WORDS}.singleTargetOnly.hint`,
				showWhen: forSpells,
			}),
		),
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
				label: `${WORDS}.schools.label`,
				hint: `${WORDS}.schools.hint`,
				showWhen: forSpells,
			}),
		),
		spells: new fields.ArrayField(
			new fields.StringField({ required: true, nullable: false, initial: '' }),
			withWidget({
				required: true,
				nullable: false,
				initial: [] as string[],
				label: `${WORDS}.spells.label`,
				hint: `${WORDS}.spells.hint`,
				showWhen: forSpells,
			}),
		),
		...resourceCostFields(),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				// Not required, so the picker lists an empty choice for no pool.
				required: false,
				nullable: false,
				initial: '',
				label: `${WORDS}.chargePoolIdentifier.label`,
				hint: `${WORDS}.chargePoolIdentifier.hint`,
				widget: 'chargePoolPicker',
			}),
		),
		actionDelta: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			integer: true,
			label: `${WORDS}.actionDelta.label`,
			hint: `${WORDS}.actionDelta.hint`,
		}),
		actionMinimum: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: 0,
				integer: true,
				label: `${WORDS}.actionMinimum.label`,
				hint: `${WORDS}.actionMinimum.hint`,
				showWhen: (data: Record<string, unknown>) => Number(data.actionDelta ?? 0) < 0,
			}),
		),
		rangePerMana: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			min: 0,
			integer: true,
			label: `${WORDS}.rangePerMana.label`,
			hint: `${WORDS}.rangePerMana.hint`,
		}),
		cardNote: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: `${WORDS}.cardNote.label`,
			hint: `${WORDS}.cardNote.hint`,
		}),
		damageTypes: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				choices: () => CONFIG.NIMBLE.damageTypes,
			}),
			{
				required: true,
				nullable: false,
				initial: [] as string[],
				label: `${WORDS}.damageTypes.label`,
				hint: `${WORDS}.damageTypes.hint`,
			},
		),
		manaDelta: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			integer: true,
			label: `${WORDS}.manaDelta.label`,
			hint: `${WORDS}.manaDelta.hint`,
		}),
		manaMinimum: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				initial: 0,
				min: 0,
				integer: true,
				label: `${WORDS}.manaMinimum.label`,
				hint: `${WORDS}.manaMinimum.hint`,
				showWhen: (data: Record<string, unknown>) => Number(data.manaDelta ?? 0) < 0,
			}),
		),
		freeCopy: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `${WORDS}.freeCopy.label`,
			hint: `${WORDS}.freeCopy.hint`,
		}),
		replacesSpellCost: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: `${WORDS}.replacesSpellCost.label`,
			hint: `${WORDS}.replacesSpellCost.hint`,
		}),
		manaSet: new fields.NumberField({
			required: false,
			nullable: true,
			initial: null,
			min: 0,
			integer: true,
			label: `${WORDS}.manaSet.label`,
			hint: `${WORDS}.manaSet.hint`,
		}),
		effectId: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: `${WORDS}.effectId.label`,
				hint: `${WORDS}.effectId.hint`,
				widget: 'itemEffectPicker',
				recipient: () => 'self' as const,
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'useOption' }),
	};
}

declare namespace UseOptionRule {
	type Schema = ResourceCostRule.Schema & ReturnType<typeof schema>;
}

/** The parts of a spell an option reads to decide whether it applies. */
interface OptionSpell {
	type?: string;
	identifier?: string;
	system?: {
		identifier?: string;
		tier?: number;
		school?: string;
		activation?: {
			acquireTargetsFromTemplate?: boolean;
			targets?: { count?: number };
		};
	};
}

/**
 * An option the player can turn on in the dialog of another item, with its own cost and
 * change. It lives on the item that owns the option. Options that name the same Charge Pool
 * share its uses.
 */
class UseOptionRule extends ResourceCostRule<UseOptionRule.Schema> {
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-list-check';

	declare target: UseOptionTarget;

	declare tieredOnly: boolean;

	declare singleTargetOnly: boolean;

	// `schools` is inferred from the schema's `choices`.

	/** Identifiers of the spells the option applies to. Empty is every spell. */
	declare spells: string[];

	declare chargePoolIdentifier: string;

	declare actionDelta: number;

	declare actionMinimum: number;

	/** Range added for each of the amount the option spends. */
	declare rangePerMana: number;

	/** A line on the card of the cast. `{amount}` is the amount the option spent. */
	declare cardNote: string;

	// `damageTypes` is inferred from the schema's `choices`.

	declare manaDelta: number;

	declare manaMinimum: number;

	declare freeCopy: boolean;

	/** The option's cost takes the place of the spell's own cost. */
	declare replacesSpellCost: boolean;

	/** The mana the spell costs at its own tier, with no upcast, or null for no change. */
	declare manaSet: number | null;

	/** An effect of the item that the caster gains after a cast with the option. */
	declare effectId: string;

	static override defineSchema(): UseOptionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		} as UseOptionRule.Schema;
	}

	/** An amount that reads the mana the cast spends is worked out when the spell is cast. */
	protected override keepsAmountAsText(text: string): boolean {
		return super.keepsAmountAsText(text) || readsCastMana(text);
	}

	/** The key of the option on the actor. */
	get key(): string {
		return ruleKey(this);
	}

	/** The Charge Pool whose uses the option spends, or '' for none. */
	get poolIdentifier(): string {
		return String(this.chargePoolIdentifier ?? '').trim();
	}

	/** How the option changes the action cost, or null when it does not. */
	get actionCostChange(): ActionCostChange | null {
		return costChangeOf(this.actionDelta, this.actionMinimum);
	}

	/** How the option changes the mana cost of the spell, or null when it does not. */
	get manaCostChange(): CostChange | null {
		return costChangeOf(this.manaDelta, this.manaMinimum);
	}

	/** The mana the spell costs with the option, or null when the option does not set it. */
	get manaCostSet(): number | null {
		const value = this.manaSet;
		if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
		return Math.max(0, Math.trunc(Number(value)));
	}

	/** The effect the caster gains after a cast with the option, or null for none. */
	get effectAfterCast(): { itemUuid: string; effectId: string } | null {
		const item = this.item;
		const effectId = String(this.effectId ?? '').trim();
		if (!effectId || !item?.uuid || !itemEffectOf(item as never, effectId)) return null;
		return { itemUuid: item.uuid, effectId };
	}

	/** Whether the option goes into the cast dialog of this spell. */
	appliesToSpell(spell: OptionSpell | null | undefined): boolean {
		if (this.target !== 'spell' || spell?.type !== 'spell') return false;
		const system = spell.system ?? {};
		if (this.tieredOnly && (system.tier ?? 0) <= 0) return false;
		if (this.singleTargetOnly && !isSingleTarget(system.activation)) return false;
		const schools = this.schools as string[];
		if (schools.length > 0 && !schools.includes(system.school ?? '')) return false;
		const identifier = spell.identifier || system.identifier || '';
		return this.spells.length === 0 || this.spells.includes(identifier);
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['target', '"spell"'],
				['tieredOnly', 'boolean'],
				['singleTargetOnly', 'boolean'],
				['schools', 'string[]'],
				['spells', 'string[]'],
				['chargePoolIdentifier', 'string'],
				['actionDelta', 'number'],
				['actionMinimum', 'number'],
				['rangePerMana', 'number'],
				['cardNote', 'string'],
				['damageTypes', 'string[]'],
				['manaDelta', 'number'],
				['manaMinimum', 'number'],
				['freeCopy', 'boolean'],
				['replacesSpellCost', 'boolean'],
				['manaSet', 'number | null'],
				['effectId', 'string'],
			]),
		);
	}
}

function costChangeOf(delta: unknown, minimum: unknown): CostChange | null {
	const change = Math.trunc(Number(delta) || 0);
	if (change === 0) return null;
	return { delta: change, minimum: Math.max(0, Math.trunc(Number(minimum) || 0)) };
}

function isSingleTarget(
	activation: { acquireTargetsFromTemplate?: boolean; targets?: { count?: number } } | undefined,
): boolean {
	return !activation?.acquireTargetsFromTemplate && (activation?.targets?.count ?? 1) === 1;
}

export { UseOptionRule };
