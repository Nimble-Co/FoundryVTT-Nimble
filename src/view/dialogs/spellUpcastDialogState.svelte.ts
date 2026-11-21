import type { AppliedTicks } from '#types/conditionRollMode.d.ts';
import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';
import type { ResourceCost, ResourceCostKind } from '#types/resourceCost.d.ts';
import type { ResolvedSpellCost } from '#types/spellCost.d.ts';
import type { ScalingDelta, SpellScaling } from '#types/spellScaling.d.ts';
import type { ChosenUseOption, UseOption, UseOptionGroup } from '#types/useOption.d.ts';
import { offersLessManaFor } from '#utils/chaos/lessMana.js';
import { withActionCostChange } from '#utils/combat/withActionCostChange.js';
import { withCastMana } from '#utils/cost/castManaCost.js';
import { variableRangeOf } from '#utils/cost/resourceCost.js';
import {
	optionEntryText,
	resourceCostText,
	rollWindowCostParts,
} from '#utils/cost/resourceCostWords.js';
import { damageMultiplierOf } from '#utils/damage/damageMultiplier.js';
import { maxDamageOffers } from '#utils/damage/maxDamageOffers.js';
import { keptAmountFor } from '#utils/heldChange/heldChange.js';
import localize from '#utils/localize.js';
import {
	rollModeWithoutConditions,
	tickedConditionRollModes,
} from '#utils/rolls/appliedConditionRollModes.js';
import { attackConditionLines } from '#utils/rolls/attackConditionLines.js';
import { openRollModeTicks } from '#utils/rolls/rollModeTicks.js';
import { computeUpcastBounds } from '#utils/spell/computeUpcastBounds.js';
import { effectMomentNumbers } from '#utils/spell/effectMomentNumbers.js';
import { effectRuleNumbers } from '#utils/spell/effectRuleNumbers.js';
import { formatSpellCostLabel, resolveEffectiveCastTier } from '#utils/spell/spellCost.js';
import { spellManaWithOptions } from '#utils/spell/spellUseOptions.js';
import { stepFormulaDieSize } from '#utils/spell/stepFormulaDieSize.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
import { rollSpendLine } from './components/rollSpendLine.ts';
import { heldChangeChoice } from './heldChangeChoice.svelte.ts';
import { resourceAmounts } from './resourceAmounts.svelte.ts';

type EffectNode = { id?: string; type: string; formula?: string };

/** The spell item's system data, as the dialog reads it. */
export interface UpcastSpell {
	tier: number;
	school: string;
	scaling?: SpellScaling | null;
	activation?: {
		effects?: EffectNode[];
		targets?: { singleTargetAttack?: boolean; attackType?: string };
	};
	properties?: { selected?: string[] };
	/** The spell item. */
	parent?: object | null;
}

export interface CreateSpellUpcastDialogStateOptions {
	actor: () => Actor;
	spell: () => UpcastSpell;
	/** The spell item, when the spell data has no parent. */
	item?: () => object | null | undefined;
	initialRollMode?: number;
	hideRollsDefault: boolean;
	/** The roll ignores disadvantage already, so the change that ignores it has no line. */
	ignoresDisadvantage?: boolean;
	/** The tier a class pins the cast to, resolved by the activation manager. */
	pinnedCastTier?: number | null;
	/** The cost the activation manager resolved for this cast. */
	spellCost?: ResolvedSpellCost | null;
	/** The actions the cast spends. */
	spendsActions?: number;
	/** Spend or Sacrifice costs of the use, for the spend line and the amounts to choose. */
	resourceCosts?: readonly ResourceCost[];
	/** The Spell or Attack Options the caster can turn on for this spell. */
	useOptionGroups?: readonly UseOptionGroup[];
}

/** The amount a player chooses for a variable option cost. */
export interface OptionAmount {
	kind: ResourceCostKind;
	minimum: number;
	limit: number;
	amount: number;
}

/** One dropdown of options, as the dialog shows it. */
/** The amount stepper and the damage type picks of the chosen option. */
export interface OptionControlsView {
	amount: OptionAmount | null;
	/** What the amount stepper says, such as "Mana (+8 range)". */
	amountLabel: string;
	/** The damage types the chosen option offers. */
	picks: Array<{ key: string; label: string }>;
	/** The chosen pick, or ''. */
	pick: string;
}

export interface OptionGroupView extends OptionControlsView {
	key: string;
	label: string;
	disabled: boolean;
	/** Why the group is disabled, or ''. */
	note: string;
	/** The key of the chosen option, or '' for None. */
	chosen: string;
	entries: Array<{ key: string; label: string }>;
}

/** The buttons under "Spend": the spell's own cost, then each option that spends in its place. */
export interface SpendChoiceView extends OptionControlsView {
	key: string;
	label: string;
	/** The key of the chosen option, or '' for the spell's own cost. */
	chosen: string;
	buttons: Array<{ key: string; label: string; disabled: boolean }>;
}

export interface UpcastTier {
	tier: number;
	/** The caster has less mana than this tier costs. */
	short: boolean;
}

/** What the dialog gives the activation manager when the spell is cast. */
export interface SpellCastData {
	rollMode: number;
	conditionRollModes: ReturnType<typeof tickedConditionRollModes>;
	situationalModifiers: string;
	primaryDieValue: number | null | undefined;
	primaryDieModifier: number | null | undefined;
	rollHidden: boolean;
	maxDamage: MaxDamageChoice | null;
	keptAmount?: boolean;
	heldChosen?: string[];
	damageMultiplier?: boolean;
	lessMana: boolean;
	upcast: { manaToSpend: number; choiceIndex: number | undefined } | undefined;
	resourceAmounts?: Record<string, number>;
	useOptions?: ChosenUseOption[];
}

function sumOfMana(costs: readonly ResourceCost[]): number {
	return costs.reduce((total, cost) => {
		const amount = Number(cost.amount);
		return cost.kind === 'mana' && Number.isFinite(amount) ? total + amount : total;
	}, 0);
}

const damageOrHealingOps = new Set(['addFlatDamage', 'addDice', 'increaseDieSize']);

export function createSpellUpcastDialogState(options: CreateSpellUpcastDialogStateOptions) {
	const {
		initialRollMode = 0,
		hideRollsDefault,
		pinnedCastTier = null,
		spellCost = null,
		spendsActions = 0,
		resourceCosts = [],
		useOptionGroups = [],
	} = options;
	const { spellUpcastDialog, effectTypes, spellProperties, itemConfig, objectTypes, damageTypes } =
		CONFIG.NIMBLE;

	// Snapshot at dialog-open time, as the activation dialog does.
	const actor = options.actor();
	const spell = options.spell();
	const spellItem = spell.parent ?? options.item?.() ?? null;
	const activatedItem = { system: spell } as never;
	const rollData = () => actor.getRollData() as NimbleRoll.Data;

	const conditionLines = attackConditionLines(
		actor as never,
		spell.activation as never,
		(
			soleTarget(game.user?.targets, {
				firstDecides: spell.activation?.targets?.singleTargetAttack === true,
			}) as { actor?: unknown } | null
		)?.actor as never,
		spell.properties?.selected,
	);
	const conditionOptions = conditionRollModeOptions(conditionLines);
	const opened = openRollModeTicks(initialRollMode, conditionOptions);
	let selectedRollMode = $state(opened.mode);
	let appliedTicks = $state<AppliedTicks>(opened.applied);
	const conditionRollModes = $derived(tickedConditionRollModes(conditionLines, appliedTicks));

	const maxDamage: MaxDamageOffer[] = maxDamageOffers(
		actor as never,
		{
			type: 'spell',
			system: spell,
		} as never,
	);
	let maxDamageChoice = $state<MaxDamageChoice | null>(null);
	const offersLessMana = offersLessManaFor(actor as never, activatedItem);
	let lessMana = $state(false);
	const held = heldChangeChoice(actor as never, activatedItem, options.ignoresDisadvantage, {
		get: () => selectedRollMode,
		set: (mode) => {
			selectedRollMode = mode;
		},
	});
	const keptAmount = keptAmountFor(actor as never, activatedItem);
	let usesKeptAmount = $state(keptAmount !== null && !held.choosing);
	const keptInUse = $derived(!!keptAmount && usesKeptAmount);
	const damageMultiplier = damageMultiplierOf(spellItem);
	let usesDamageMultiplier = $state(false);
	let situationalModifiers = $state('');
	let primaryDieValue = $state<number | null | undefined>();
	let primaryDieModifier = $state<number | null | undefined>();
	let shouldRollBeHidden = $state(hideRollsDefault);

	// With resource spending automation off, costs stay visible but available
	// mana neither bounds the tiers nor blocks the cast.
	const enforceManaCost = isResourceSpendingAutomationEnabled();

	// A pinned tier only lifts a spell that scales to it; any other spell
	// casts, and is labelled, at its own tier.
	const effectiveCastTier = resolveEffectiveCastTier(activatedItem, pinnedCastTier);
	const isPoolCost = spellCost?.type === 'pool';

	const baseMana = spell.tier;
	// A pool cost is the same at every tier, so it buys no upcast steps unless
	// the class pins the tier.
	const { currentMana, maxTier, maxMana } = computeUpcastBounds({
		spellTier: spell.tier,
		resources: (actor as { system?: { resources?: never } } | null)?.system?.resources,
		enforceManaCost: enforceManaCost && !isPoolCost,
		flatCost: isPoolCost,
		pinnedCastTier,
	});
	const tierNumbers = Array.from(
		{ length: maxMana - baseMana + 1 },
		(_, index) => baseMana + index,
	);

	const scalesUp =
		spell.tier > 0 &&
		!!spell.scaling &&
		spell.scaling.mode !== 'none' &&
		(pinnedCastTier === null ? maxMana > baseMana : pinnedCastTier > baseMana);
	const hasChoices = spell.scaling?.mode === 'upcastChoice';
	const isHealingSpell = !!spell.activation?.effects?.some((e) => e.type === 'healing');

	let manaToSpend = $state(effectiveCastTier ?? baseMana);
	let choiceIndex = $state(0);

	// Mana costs track the chosen tier, so the label is rebuilt as it moves.
	const costLabel = $derived(
		spellCost
			? formatSpellCostLabel(
					spellCost.type === 'mana' ? { type: 'mana', amount: manaToSpend } : spellCost,
				)
			: null,
	);
	const resources = resourceAmounts(actor, resourceCosts);

	const enforcesOptionCosts = isResourceSpendingAutomationEnabled();
	let optionChoices = $state<Record<string, string>>({});
	let optionAmounts = $state<Record<string, number>>({});
	let optionPicks = $state<Record<string, string>>({});

	function pickOf(option: UseOption): string {
		const pick = optionPicks[option.key] ?? '';
		return option.damageTypes.includes(pick) ? pick : '';
	}

	function chosenOptionOf(group: UseOptionGroup): UseOption | null {
		const key = optionChoices[group.key] ?? '';
		return group.options.find((each) => each.key === key) ?? null;
	}

	const pickedOptions = $derived(useOptionGroups.flatMap((group) => chosenOptionOf(group) ?? []));
	const manaCostChanges = $derived(pickedOptions.flatMap((option) => option.manaCostChange ?? []));
	/** An option's cost takes the place of the spell's own cost. */
	const replacesSpellCost = $derived(pickedOptions.some((option) => option.replacesSpellCost));
	const manaSet = $derived(
		pickedOptions.find((option) => option.manaSet !== null)?.manaSet ?? null,
	);
	/** A chosen option casts the spell at its own tier. */
	const tierLocked = $derived(replacesSpellCost || manaSet !== null);
	/** A different spend keeps a pinned tier, and with it the choice of enhancement. */
	const keepsPinnedTier = $derived(manaSet === null && pinnedCastTier !== null);
	const canUpcast = $derived(scalesUp && (!tierLocked || keepsPinnedTier));
	const castTier = $derived(
		!tierLocked ? manaToSpend : manaSet === null ? (effectiveCastTier ?? baseMana) : baseMana,
	);
	const upcastSteps = $derived(castTier - baseMana);

	/** The mana a tier costs: less mana first, then the chosen options, as the cast spends it. */
	function manaOfTier(tier: number): number {
		const mana = lessMana && tier > 0 ? tier - 1 : tier;
		return mana > 0 ? spellManaWithOptions(mana, { manaSet, manaCostChanges }) : 0;
	}

	/** The mana of the spell at the chosen tier, which every other mana spend comes after. */
	const spellMana = $derived(
		baseMana > 0 && !isPoolCost && !replacesSpellCost ? manaOfTier(castTier) : 0,
	);

	function optionAmountOf(option: UseOption): OptionAmount | null {
		const range = variableRangeOf(actor as never, option.cost);
		if (!range) return null;
		const left = option.cost.kind === 'mana' ? currentMana - spellMana : range.limit;
		const limit = enforcesOptionCosts
			? Math.max(range.minimum, Math.min(range.limit, left))
			: range.limit;
		const chosen = optionAmounts[option.key] ?? range.minimum;
		return {
			kind: option.cost.kind,
			minimum: range.minimum,
			limit,
			amount: Math.clamp(chosen, range.minimum, limit),
		};
	}

	const chosenOptions = $derived(
		useOptionGroups.flatMap((group) => {
			const option = chosenOptionOf(group);
			if (!option) return [];
			const amount = optionAmountOf(option);
			return [{ option, amount, damageType: pickOf(option) }];
		}),
	);

	/** The option costs of a cast that spends `castMana` on the spell, with the chosen amounts. */
	function optionCostsAt(castMana: number): ResourceCost[] {
		return chosenOptions.map(({ option, amount }) =>
			amount
				? { ...option.cost, amount: amount.amount }
				: withCastMana(actor, option.cost, castMana),
		);
	}

	const otherCosts = $derived([...resources.chosen(), ...optionCostsAt(spellMana)]);
	const otherMana = $derived(sumOfMana(otherCosts));

	const tiers = $derived<UpcastTier[]>(
		tierNumbers.map((tier) => {
			const mana = manaOfTier(tier);
			const others = sumOfMana([...resources.chosen(), ...optionCostsAt(mana)]);
			return { tier, short: mana + others > currentMana };
		}),
	);

	const actionsSpent = $derived(
		spendsActions > 0
			? chosenOptions.reduce(
					(actions, { option }) => withActionCostChange(actions, option.actionCostChange),
					spendsActions,
				)
			: 0,
	);

	const spendLine = $derived.by(() => {
		const notMana = otherCosts.filter(
			(cost) => cost.kind !== 'mana' || !Number.isFinite(Number(cost.amount)),
		);
		const parts = rollWindowCostParts(notMana);
		const mana =
			spellCost?.type === 'mana'
				? [formatSpellCostLabel({ type: 'mana', amount: spellMana + otherMana }) ?? '']
				: [
						replacesSpellCost ? '' : (costLabel ?? ''),
						...rollWindowCostParts(
							otherMana > 0
								? [
										{
											kind: 'mana',
											amount: otherMana,
											spend: { mode: 'fixed' },
											beyond: 'notAllowed',
										},
									]
								: [],
						).spends,
					];
		return rollSpendLine(actionsSpent, [...mana, ...parts.spends], parts.sacrifices);
	});

	/** The spell's own cost, as its Spend button names it. */
	function ownCostText(): string {
		if (spellCost?.type === 'mana' || (!spellCost && baseMana > 0)) {
			return resourceCostText('mana', manaOfTier(manaToSpend));
		}
		return (
			(spellCost ? formatSpellCostLabel(spellCost) : null) ?? localize('NIMBLE.useOptions.none')
		);
	}

	const spendChoice = $derived.by<SpendChoiceView | null>(() => {
		const group = useOptionGroups.find((each) => each.spend);
		if (!group) return null;
		const option = chosenOptionOf(group);
		return {
			key: group.key,
			label: group.label,
			chosen: option?.key ?? '',
			...optionControlsOf(option),
			buttons: [
				{ key: '', label: ownCostText(), disabled: false },
				...group.options.map((option) => ({
					key: option.key,
					label: spendText(option),
					disabled: enforcesOptionCosts && option.used,
				})),
			],
		};
	});

	/** "10 temp HP (<option>)". */
	function spendText(option: UseOption): string {
		const cost = withCastMana(actor, option.cost, spellMana);
		return localize('NIMBLE.useOptions.spendEntry', {
			name: option.name,
			cost: resourceCostText(cost.kind, cost.amount),
		});
	}

	const optionGroups = $derived<OptionGroupView[]>(
		useOptionGroups
			.filter((group) => !group.spend)
			.map((group) => {
				const disabled = enforcesOptionCosts && group.used;
				const option = chosenOptionOf(group);
				return {
					key: group.key,
					label: group.label,
					disabled,
					note: disabled
						? localize(
								group.refillsEachTurn
									? 'NIMBLE.useOptions.usedThisTurn'
									: 'NIMBLE.useOptions.noUsesLeft',
							)
						: '',
					chosen: option?.key ?? '',
					...optionControlsOf(option),
					entries: [
						{ key: '', label: localize('NIMBLE.useOptions.none') },
						...group.options.map((each) => ({
							key: each.key,
							label: optionEntryText(each.name, withCastMana(actor, each.cost, spellMana)),
						})),
					],
				};
			}),
	);

	function optionControlsOf(option: UseOption | null): OptionControlsView {
		const amount = option ? optionAmountOf(option) : null;
		return {
			amount,
			amountLabel: option ? amountLabelOf(option, amount) : '',
			picks: (option?.damageTypes ?? []).map((type) => ({
				key: type,
				label: localize(damageTypes[type as keyof typeof damageTypes] ?? type),
			})),
			pick: option ? pickOf(option) : '',
		};
	}

	function amountLabelOf(option: UseOption, amount: OptionAmount | null): string {
		if (!amount) return '';
		const label = localize(`NIMBLE.useOptions.amountLabel.${amount.kind}`);
		if (option.rangePerMana <= 0) return label;
		return localize('NIMBLE.useOptions.amountWithRange', {
			label,
			range: String(option.rangePerMana * amount.amount),
		});
	}

	function chooseOption(groupKey: string, optionKey: string) {
		const group = useOptionGroups.find((each) => each.key === groupKey);
		if (!group || (enforcesOptionCosts && group.used)) return;
		const option = group.options.find((each) => each.key === optionKey);
		if (option && enforcesOptionCosts && option.used) return;
		if (optionKey === '' || option) optionChoices = { ...optionChoices, [groupKey]: optionKey };
	}

	function chooseOptionPick(groupKey: string, pick: string) {
		const group = useOptionGroups.find((each) => each.key === groupKey);
		const option = group ? chosenOptionOf(group) : null;
		if (option?.damageTypes.includes(pick)) optionPicks = { ...optionPicks, [option.key]: pick };
	}

	function setOptionAmount(groupKey: string, value: number) {
		const group = useOptionGroups.find((each) => each.key === groupKey);
		const option = group ? chosenOptionOf(group) : null;
		const range = option ? optionAmountOf(option) : null;
		if (!option || !range) return;
		const next = Number.isFinite(value) ? Math.floor(value) : range.minimum;
		optionAmounts = {
			...optionAmounts,
			[option.key]: Math.clamp(next, range.minimum, range.limit),
		};
	}

	const upcastPreview = $derived.by(() => {
		if (!canUpcast || upcastSteps === 0) return [];

		const deltas: ScalingDelta[] = hasChoices
			? (spell.scaling?.choices?.[choiceIndex]?.deltas ?? [])
			: (spell.scaling?.deltas ?? []);

		const preview = deltas.map((delta) => {
			if (delta.operation === 'increaseDieSize') return formatDieSizePreview(delta, upcastSteps);
			if (delta.operation === 'raiseEffectRule') return formatRaisePreview(delta, upcastSteps);
			if (delta.operation === 'lengthenLastsUntil')
				return formatLengthenPreview(delta, upcastSteps);
			return formatDeltaPreview(delta, getScaledAmount(delta, upcastSteps));
		});

		// A choice that does not change damage or healing shows the base effect.
		if (!deltas.some((d) => damageOrHealingOps.has(d.operation))) {
			const baseEffect = spell.activation?.effects?.find(
				(e) => (e.type === 'damage' || e.type === 'healing') && e.formula,
			);
			if (baseEffect?.formula) {
				const calculated = new NimbleRoll(baseEffect.formula, rollData());
				preview.push(`${calculated.formula} ${effectLabel(baseEffect.type)}`);
			}
		}

		return preview;
	});

	function effectLabel(type: string) {
		return type === 'healing' ? effectTypes.healing : `${spell.school} ${effectTypes.damage}`;
	}

	function getScaledAmount(delta: ScalingDelta, steps: number) {
		if (delta.operation === 'addDice' && delta.dice) {
			return `${delta.dice.count * steps}d${delta.dice.faces}`;
		}
		if (delta.value !== null && delta.value !== undefined) {
			return delta.value * steps;
		}
		return delta.condition || '';
	}

	// The upgraded die when there is a formula to step, otherwise the step itself.
	function formatDieSizePreview(delta: ScalingDelta, steps: number) {
		const scaledSteps = (delta.value ?? 1) * steps;
		const targetEffect = findDieSizeTargetEffect(delta.targetEffectId);

		if (targetEffect?.formula) {
			const steppedFormula = stepFormulaDieSize(
				targetEffect.formula,
				scaledSteps,
				delta.maxDieFaces ?? null,
			);
			return `${new NimbleRoll(steppedFormula, rollData()).formula} ${effectLabel(targetEffect.type)}`;
		}

		if (delta.maxDieFaces) {
			return localize(spellUpcastDialog.increaseDieSizeCapped, {
				steps: String(scaledSteps),
				maxFaces: String(delta.maxDieFaces),
			});
		}

		return localize(spellUpcastDialog.increaseDieSize, { steps: String(scaledSteps) });
	}

	function formatRaisePreview(delta: ScalingDelta, steps: number) {
		const target = effectRuleNumbers((spell.parent ?? {}) as never).find(
			(node) => node.nodeId === delta.targetEffectId,
		);
		const rule = target?.rules.find((entry) => entry.id === delta.ruleId);
		const field = rule?.fields.find((entry) => entry.name === delta.ruleField);
		const amount = delta.formula
			? formulaRaiseAmount(delta.formula, steps)
			: String((delta.value ?? 0) * steps);
		return localize(spellUpcastDialog.raiseEffectRule, {
			rule: rule?.label ?? target?.label ?? '',
			amount,
			field: field?.label ?? delta.ruleField ?? '',
		});
	}

	// The terms the cast adds, worked out from the caster when they have no dice.
	function formulaRaiseAmount(formula: string, steps: number) {
		const terms = Array.from({ length: steps }, () => formula).join(' + ');
		try {
			const roll = new Roll(terms, actor.getRollData());
			return roll.isDeterministic ? String(roll.evaluateSync().total) : roll.formula;
		} catch {
			return terms;
		}
	}

	function formatLengthenPreview(delta: ScalingDelta, steps: number) {
		const target = effectMomentNumbers((spell.parent ?? {}) as never).find(
			(node) => node.nodeId === delta.targetEffectId,
		);
		const moment = target?.moments.find((entry) => entry.index === delta.momentIndex);
		const value = (delta.value ?? 0) * steps;
		const units = moment?.units ?? 'turns';
		const amount =
			value === 1
				? localize(`NIMBLE.lastsUntilText.units.${units}.one`)
				: localize(`NIMBLE.lastsUntilText.units.${units}.many`, { value: String(value) });
		return localize(spellUpcastDialog.lengthenLastsUntil, { effect: target?.label ?? '', amount });
	}

	function findDieSizeTargetEffect(targetEffectId: string | null | undefined) {
		const nodes = flattenEffectsTree((spell.activation?.effects ?? []) as never) as EffectNode[];

		// Damage before healing, the search order applyDelta uses when casting.
		const findByType = (type: string) =>
			nodes.find(
				(node) =>
					node.type === type &&
					(targetEffectId ? node.id === targetEffectId : Boolean(node.formula)),
			);

		return findByType('damage') ?? findByType('healing');
	}

	function formatDeltaPreview(delta: ScalingDelta, amount: string | number) {
		const label = isHealingSpell ? effectTypes.healing : `${spell.school} ${effectTypes.damage}`;
		const operations = {
			addFlatDamage: `+${amount} ${label}`,
			addDice: `+${amount} ${label}`,
			addReach: `+${amount} ${spellProperties.reach}`,
			addRange: `+${amount} ${spellProperties.range}`,
			addTargets: `+${amount} ${Number(amount) > 1 ? itemConfig.targets : itemConfig.target}`,
			addAreaSize: `+${amount} ${itemConfig.areaSize}`,
			addDC: `+${amount} DC`,
			addDuration: `+${amount} ${itemConfig.duration}`,
			addCondition: `+${amount} ${effectTypes.condition}`,
			addArmor: `+${amount} ${objectTypes.armor}`,
		};
		return operations[delta.operation as keyof typeof operations] || delta.operation;
	}

	/** Why the cast cannot go ahead, or '' when it can. */
	const castWarning = $derived.by(() => {
		if (situationalModifiers !== '' && !Roll.validate(situationalModifiers)) {
			return localize('NIMBLE.hitDice.invalidAddToRoll');
		}
		const unpicked = chosenOptions.find(
			({ option, damageType }) => option.damageTypes.length > 0 && !damageType,
		);
		if (unpicked) return localize('NIMBLE.useOptions.choosePick', { name: unpicked.option.name });

		// Only a tiered spell that costs mana; a class pool cost is checked on
		// the activation path.
		if (baseMana > 0 && !isPoolCost && castTier < baseMana) {
			return localize(spellUpcastDialog.warnings.minMana, { min: String(baseMana) });
		}
		// A cost that may go beyond what the caster has asks to confirm when it is spent.
		const needed = spellMana + sumOfMana(otherCosts.filter((cost) => cost.beyond === 'notAllowed'));
		if (enforceManaCost && needed > currentMana) {
			return localize(spellUpcastDialog.warnings.insufficientMana, {
				current: String(currentMana),
				needed: String(needed),
			});
		}

		if (!tierLocked && manaToSpend > maxTier) {
			return localize(spellUpcastDialog.warnings.aboveMaxTier, { maxTier: String(maxTier) });
		}
		return '';
	});

	const castData = $derived<SpellCastData>({
		rollMode: rollModeWithoutConditions(selectedRollMode, conditionRollModes) - held.rollMode,
		conditionRollModes,
		situationalModifiers,
		primaryDieValue,
		primaryDieModifier,
		rollHidden: shouldRollBeHidden,
		maxDamage: maxDamageChoice,
		...(keptAmount ? { keptAmount: usesKeptAmount } : {}),
		...held.rollOptions,
		...(damageMultiplier ? { damageMultiplier: usesDamageMultiplier } : {}),
		lessMana,
		upcast: canUpcast
			? { manaToSpend, choiceIndex: hasChoices ? choiceIndex : undefined }
			: undefined,
		...(resources.variableCosts.length > 0 ? { resourceAmounts: resources.amounts } : {}),
		...(chosenOptions.length > 0
			? {
					useOptions: chosenOptions.map(({ option, amount, damageType }) => ({
						key: option.key,
						...(amount ? { amount: amount.amount } : {}),
						...(damageType ? { damageType } : {}),
					})),
				}
			: {}),
	});

	return {
		// Roll fields (read/write through getter/setter so Svelte tracks writes).
		get selectedRollMode() {
			return selectedRollMode;
		},
		set selectedRollMode(value: number) {
			selectedRollMode = value;
		},
		conditionOptions,
		get appliedTicks() {
			return appliedTicks;
		},
		set appliedTicks(value: AppliedTicks) {
			appliedTicks = value;
		},
		get conditionRollModes() {
			return conditionRollModes;
		},
		get situationalModifiers() {
			return situationalModifiers;
		},
		set situationalModifiers(value: string) {
			situationalModifiers = value;
		},
		get primaryDieValue() {
			return primaryDieValue;
		},
		set primaryDieValue(value: number | null | undefined) {
			primaryDieValue = value;
		},
		get primaryDieModifier() {
			return primaryDieModifier;
		},
		set primaryDieModifier(value: number | null | undefined) {
			primaryDieModifier = value;
		},
		get shouldRollBeHidden() {
			return shouldRollBeHidden;
		},
		set shouldRollBeHidden(value: boolean) {
			shouldRollBeHidden = value;
		},

		// Ticks that change the roll.
		maxDamageOffers: maxDamage,
		get maxDamageChoice() {
			return maxDamageChoice;
		},
		set maxDamageChoice(value: MaxDamageChoice | null) {
			maxDamageChoice = value;
		},
		offersLessMana,
		get lessMana() {
			return lessMana;
		},
		set lessMana(value: boolean) {
			lessMana = value;
		},
		keptAmount,
		get usesKeptAmount() {
			return usesKeptAmount;
		},
		set usesKeptAmount(value: boolean) {
			usesKeptAmount = value;
		},
		get keptInUse() {
			return keptInUse;
		},
		damageMultiplier,
		get usesDamageMultiplier() {
			return usesDamageMultiplier;
		},
		set usesDamageMultiplier(value: boolean) {
			usesDamageMultiplier = value;
		},
		heldLines: held.lines,
		choosesHeldChanges: held.choosing,
		get chosenHeldChanges() {
			return held.chosen;
		},
		set chosenHeldChanges(value: string[]) {
			held.chosen = value;
		},

		// Cost and tier.
		get spendLine() {
			return spendLine;
		},
		pinnedCastTier,
		get effectiveCastTier() {
			return manaSet === null ? effectiveCastTier : null;
		},
		get canUpcast() {
			return canUpcast;
		},
		baseMana,
		get tiers() {
			return tiers;
		},
		get manaToSpend() {
			return manaToSpend;
		},
		set manaToSpend(value: number) {
			manaToSpend = value;
		},
		get upcastSteps() {
			return upcastSteps;
		},
		hasChoices,
		choices: spell.scaling?.choices ?? null,
		get choiceIndex() {
			return choiceIndex;
		},
		set choiceIndex(value: number) {
			choiceIndex = value;
		},
		get upcastPreview() {
			return upcastPreview;
		},

		// Spend or Sacrifice amounts and Spell or Attack Options.
		get variableResourceCosts() {
			return resources.variableCosts;
		},
		get resourceAmounts() {
			return resources.amounts;
		},
		setResourceAmount: resources.set,
		adjustResourceAmount: resources.adjust,
		get optionGroups() {
			return optionGroups;
		},
		get spendChoice() {
			return spendChoice;
		},
		chooseOption,
		chooseOptionPick,
		setOptionAmount,

		// The cast.
		get castWarning() {
			return castWarning;
		},
		get castData() {
			return castData;
		},
	};
}
