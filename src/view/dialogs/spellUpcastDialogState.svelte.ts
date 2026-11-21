import type { AppliedTicks } from '#types/conditionRollMode.d.ts';
import type { MaxDamageChoice, MaxDamageOffer } from '#types/maxDamage.d.ts';
import type { ResolvedSpellCost } from '#types/spellCost.d.ts';
import type { ScalingDelta, SpellScaling } from '#types/spellScaling.d.ts';
import { offersLessManaFor } from '#utils/chaos/lessMana.js';
import { rollWindowCostParts } from '#utils/cost/resourceCostWords.js';
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
import { stepFormulaDieSize } from '#utils/spell/stepFormulaDieSize.js';
import { soleTarget } from '#utils/tokens/soleTarget.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
import { rollSpendLine } from './components/rollSpendLine.ts';
import { heldChangeChoice } from './heldChangeChoice.svelte.ts';

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
	/** Spend or Sacrifice costs of the use, for the spend line. */
	resourceCosts?: Parameters<typeof rollWindowCostParts>[0];
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
	} = options;
	const { spellUpcastDialog, effectTypes, spellProperties, itemConfig, objectTypes } =
		CONFIG.NIMBLE;
	const format = (key: string, data?: Record<string, string>) => game.i18n.format(key, data);

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
	const tiers: UpcastTier[] = Array.from({ length: maxMana - baseMana + 1 }, (_, index) => {
		const tier = baseMana + index;
		return { tier, short: tier > currentMana };
	});

	const canUpcast =
		spell.tier > 0 &&
		!!spell.scaling &&
		spell.scaling.mode !== 'none' &&
		(pinnedCastTier === null ? maxMana > baseMana : pinnedCastTier > baseMana);
	const hasChoices = spell.scaling?.mode === 'upcastChoice';
	const isHealingSpell = !!spell.activation?.effects?.some((e) => e.type === 'healing');

	let manaToSpend = $state(effectiveCastTier ?? baseMana);
	let choiceIndex = $state(0);
	const upcastSteps = $derived(manaToSpend - baseMana);

	// Mana costs track the chosen tier, so the label is rebuilt as it moves.
	const costLabel = $derived(
		spellCost
			? formatSpellCostLabel(
					spellCost.type === 'mana' ? { type: 'mana', amount: manaToSpend } : spellCost,
				)
			: null,
	);
	const costParts = rollWindowCostParts(resourceCosts);
	const spendLine = $derived(
		rollSpendLine(spendsActions, [costLabel ?? '', ...costParts.spends], costParts.sacrifices),
	);

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
			return format(spellUpcastDialog.increaseDieSizeCapped, {
				steps: String(scaledSteps),
				maxFaces: String(delta.maxDieFaces),
			});
		}

		return format(spellUpcastDialog.increaseDieSize, { steps: String(scaledSteps) });
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
		return format(spellUpcastDialog.raiseEffectRule, {
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
				: format(`NIMBLE.lastsUntilText.units.${units}.many`, { value: String(value) });
		return format(spellUpcastDialog.lengthenLastsUntil, { effect: target?.label ?? '', amount });
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
			return format('NIMBLE.hitDice.invalidAddToRoll');
		}

		// Only a tiered spell that costs mana; a class pool cost is checked on
		// the activation path.
		if (baseMana > 0 && !isPoolCost) {
			if (manaToSpend < baseMana) {
				return format(spellUpcastDialog.warnings.minMana, { min: String(baseMana) });
			}
			if (enforceManaCost && manaToSpend > currentMana) {
				return format(spellUpcastDialog.warnings.insufficientMana, {
					current: String(currentMana),
					needed: String(manaToSpend),
				});
			}
		}

		if (manaToSpend > maxTier) {
			return format(spellUpcastDialog.warnings.aboveMaxTier, { maxTier: String(maxTier) });
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
		effectiveCastTier,
		canUpcast,
		baseMana,
		tiers,
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

		// The cast.
		get castWarning() {
			return castWarning;
		},
		get castData() {
			return castData;
		},
	};
}
