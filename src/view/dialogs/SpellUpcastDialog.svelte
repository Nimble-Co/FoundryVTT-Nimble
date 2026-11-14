<script lang="ts">
	import { untrack } from 'svelte';
	import type { MaxDamageChoice } from '#types/maxDamage.d.ts';
	import type { ScalingDelta } from '#types/spellScaling.js';
	import { SYSTEM_ID } from '#system';
	import { NimbleRoll } from '../../dice/NimbleRoll';
	import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
	import { heldChangeChoice } from './heldChangeChoice.svelte.ts';
	import { flattenEffectsTree } from '../../utils/treeManipulation/flattenEffectsTree.js';
	import { computeUpcastBounds } from '../../utils/spell/computeUpcastBounds.js';
	import { formatSpellCostLabel, resolveEffectiveCastTier } from '../../utils/spell/spellCost.js';
	import { stepFormulaDieSize } from '../../utils/spell/stepFormulaDieSize.js';
	import { effectMomentNumbers } from '../../utils/spell/effectMomentNumbers.js';
	import { effectRuleNumbers } from '../../utils/spell/effectRuleNumbers.js';
	import localize from '../../utils/localize.js';
	import { maxDamageOffers } from '../../utils/damage/maxDamageOffers.js';
	import { offersLessManaFor } from '../../utils/chaos/lessMana.js';
	import { damageMultiplierOf } from '../../utils/damage/damageMultiplier.js';
	import { keptAmountFor } from '../../utils/heldChange/heldChange.js';
	import KeptAmountField from './components/KeptAmountField.svelte';
	import DamageMultiplierField from './components/DamageMultiplierField.svelte';
	import HeldChangeLines from './components/HeldChangeLines.svelte';
	import LessManaField from './components/LessManaField.svelte';
	import MaxDamageField from './components/MaxDamageField.svelte';
	import RollModeField from './components/RollModeField.svelte';
	import RollModifierFields from './components/RollModifierFields.svelte';
	import RollWindow from './components/RollWindow.svelte';
	import SituationalRollModeList from './components/SituationalRollModeList.svelte';
	import { attackConditionLines } from '../../utils/rolls/attackConditionLines.js';
	import { conditionRollModeOptions } from './components/conditionRollModeOptions.ts';
	import {
		rollModeWithoutConditions,
		tickedConditionRollModes,
	} from '../../utils/rolls/appliedConditionRollModes.js';
	import { openRollModeTicks } from '../../utils/rolls/rollModeTicks.js';
	import { soleTarget } from '../../utils/tokens/soleTarget.js';
	import { rollSpendLine } from './components/rollSpendLine.ts';

	let { actor, dialog, spell, ...data } = $props();

	// `spell` is the item's system DataModel; its `parent` is the item document.
	const spellName = $derived(spell?.parent?.name ?? dialog?.item?.name ?? '');

	// Initialize state
	const conditionLines = untrack(() =>
		attackConditionLines(
			actor,
			spell?.activation,
			(
				soleTarget(game.user?.targets, {
					firstDecides: spell?.activation?.targets?.singleTargetAttack === true,
				}) as { actor?: unknown } | null
			)?.actor ?? null,
			spell?.properties?.selected,
		),
	);
	const conditionOptions = conditionRollModeOptions(conditionLines);
	const opened = untrack(() => openRollModeTicks(data.rollMode ?? 0, conditionOptions));
	let selectedRollMode = $state(opened.mode);
	let appliedTicks = $state(opened.applied);
	const conditionRollModes = $derived(tickedConditionRollModes(conditionLines, appliedTicks));
	const offers = maxDamageOffers(
		untrack(() => actor),
		{ type: 'spell', system: untrack(() => spell) },
	);
	let maxDamageChoice = $state<MaxDamageChoice | null>(null);
	const offersLessMana = untrack(() =>
		offersLessManaFor(actor as never, { system: spell } as never),
	);
	let lessMana = $state(false);
	const held = untrack(() =>
		heldChangeChoice(actor, { system: spell }, data.ignoreDisadvantage, {
			get: () => selectedRollMode,
			set: (mode) => {
				selectedRollMode = mode;
			},
		}),
	);
	const keptAmount = untrack(() => keptAmountFor(actor, { system: spell }));
	let usesKeptAmount = $state(keptAmount !== null && !held.choosing);
	const keptInUse = $derived(!!keptAmount && usesKeptAmount);
	const damageMultiplier = untrack(() => damageMultiplierOf(spell?.parent ?? dialog?.item));
	let usesDamageMultiplier = $state(false);
	let situationalModifiers = $state('');
	let primaryDieValue = $state();
	let primaryDieModifier = $state();
	// @ts-expect-error - nimble isn't included in the type
	let shouldRollBeHidden = $state(!!game.settings.get(SYSTEM_ID, 'hideRolls'));

	// I18n helpers
	const {
		spellUpcastDialog,
		effectTypes,
		spellProperties,
		itemConfig,
		objectTypes,
		skillCheckDialog,
	} = CONFIG.NIMBLE;
	const format = (key: string, data?: Record<string, string>) => game.i18n.format(key, data);

	// With resource spending automation off, costs stay visible but available
	// mana neither bounds the slider nor blocks the cast.
	const enforceManaCost = isResourceSpendingAutomationEnabled();

	// A class may pin the cast tier and declare a pool cost; both are resolved
	// by the activation manager and passed in rather than computed here.
	const pinnedCastTier = $derived((data.pinnedCastTier ?? null) as number | null);
	// A pinned tier only lifts a spell that scales to it; any other spell
	// casts, and is labelled, at its own tier.
	const effectiveCastTier = $derived(resolveEffectiveCastTier({ system: spell }, pinnedCastTier));
	const spellCost = $derived(data.spellCost ?? null);
	const isPoolCost = $derived(spellCost?.type === 'pool');

	const baseMana = $derived(spell.tier);
	// A pool cost is the same at every tier, so it buys no upcast steps unless
	// the class pins the tier.
	const bounds = $derived(
		computeUpcastBounds({
			spellTier: spell.tier,
			resources: actor?.system?.resources,
			enforceManaCost: enforceManaCost && !isPoolCost,
			flatCost: isPoolCost,
			pinnedCastTier,
		}),
	);
	const currentMana = $derived(bounds.currentMana);
	const maxTier = $derived(bounds.maxTier);
	const maxMana = $derived(bounds.maxMana);
	const tiers = $derived(
		Array.from({ length: maxMana - baseMana + 1 }, (_, index) => baseMana + index),
	);

	// Check if spell can be upcast (also guard against min >= max slider reset)
	const canUpcast = $derived(
		spell.tier > 0 &&
			spell.scaling &&
			spell.scaling.mode !== 'none' &&
			(pinnedCastTier === null ? maxMana > baseMana : pinnedCastTier > baseMana),
	);
	const hasChoices = $derived(spell.scaling?.mode === 'upcastChoice');
	const isHealingSpell = $derived(
		spell.activation?.effects?.some((e: { type: string }) => e.type === 'healing'),
	);

	// Upcast state
	let manaToSpend = $state(untrack(() => effectiveCastTier ?? baseMana));
	let choiceIndex = $state(0);

	// Derived values
	let upcastSteps = $derived(manaToSpend - baseMana);
	// Mana costs track the tier the slider is on, so the label is rebuilt as it moves.
	const costLabel = $derived(
		spellCost
			? formatSpellCostLabel(
					spellCost.type === 'mana' ? { type: 'mana', amount: manaToSpend } : spellCost,
				)
			: null,
	);

	const spendLine = $derived(rollSpendLine(data.spendsActions, costLabel ?? ''));

	// Compute preview of upcast effects
	const damageOrHealingOps = new Set(['addFlatDamage', 'addDice', 'increaseDieSize']);

	let upcastPreview = $derived(() => {
		if (!canUpcast || upcastSteps === 0) return [];

		const deltas: ScalingDelta[] = hasChoices
			? spell.scaling.choices[choiceIndex]?.deltas || []
			: spell.scaling.deltas;

		const preview = deltas.map((delta: ScalingDelta) => {
			if (delta.operation === 'increaseDieSize') return formatDieSizePreview(delta, upcastSteps);
			if (delta.operation === 'raiseEffectRule') return formatRaisePreview(delta, upcastSteps);
			if (delta.operation === 'lengthenLastsUntil')
				return formatLengthenPreview(delta, upcastSteps);

			const amount = getScaledAmount(delta, upcastSteps);
			return formatDeltaPreview(delta, amount, spell.school);
		});

		// If the chosen enhancement doesn't modify damage/healing, show the base effect
		const modifiesDamageOrHealing = deltas.some((d: ScalingDelta) =>
			damageOrHealingOps.has(d.operation),
		);
		if (!modifiesDamageOrHealing) {
			const baseEffect = spell.activation?.effects?.find(
				(e: { type: string; formula?: string }) =>
					(e.type === 'damage' || e.type === 'healing') && e.formula,
			);
			if (baseEffect) {
				const label =
					baseEffect.type === 'healing'
						? effectTypes.healing
						: `${spell.school} ${effectTypes.damage}`;
				const calculatedFormula = new NimbleRoll(baseEffect.formula, actor.getRollData());
				preview.push(`${calculatedFormula.formula} ${label}`);
			}
		}

		return preview;
	});

	function getScaledAmount(delta: ScalingDelta, steps: number) {
		if (delta.operation === 'addDice' && delta.dice) {
			return `${delta.dice.count * steps}d${delta.dice.faces}`;
		}
		if (delta.value !== null && delta.value !== undefined) {
			return delta.value * steps;
		}
		return delta.condition || '';
	}

	// Show the upgraded die when there is a formula to step, otherwise describe the step itself
	function formatDieSizePreview(delta: ScalingDelta, steps: number) {
		const scaledSteps = (delta.value ?? 1) * steps;
		const targetEffect = findDieSizeTargetEffect(delta.targetEffectId);

		if (targetEffect?.formula) {
			const steppedFormula = stepFormulaDieSize(
				targetEffect.formula,
				scaledSteps,
				delta.maxDieFaces ?? null,
			);
			const label =
				targetEffect.type === 'healing'
					? effectTypes.healing
					: `${spell.school} ${effectTypes.damage}`;
			return `${new NimbleRoll(steppedFormula, actor.getRollData()).formula} ${label}`;
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
		const target = effectRuleNumbers(spell?.parent ?? {}).find(
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
		const target = effectMomentNumbers(spell?.parent ?? {}).find(
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

	function findDieSizeTargetEffect(targetEffectId: string | null) {
		const nodes = flattenEffectsTree(spell.activation?.effects ?? []) as Array<{
			id: string;
			type: string;
			formula?: string;
		}>;

		// Damage before healing, mirroring the search order applyDelta uses when casting
		const findByType = (type: string) =>
			nodes.find(
				(node) =>
					node.type === type &&
					(targetEffectId ? node.id === targetEffectId : Boolean(node.formula)),
			);

		return findByType('damage') ?? findByType('healing');
	}

	function formatDeltaPreview(
		delta: ScalingDelta,
		amount: ReturnType<typeof getScaledAmount>,
		school: string,
	) {
		const effectLabel = isHealingSpell ? effectTypes.healing : `${school} ${effectTypes.damage}`;
		const operations = {
			addFlatDamage: `+${amount} ${effectLabel}`,
			addDice: `+${amount} ${effectLabel}`,
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

	function onCast() {
		// Validate situational modifiers
		if (situationalModifiers !== '') {
			const isValid = Roll.validate(situationalModifiers);
			if (!isValid) {
				ui.notifications?.warn(format('NIMBLE.hitDice.invalidAddToRoll'));
				return;
			}
		}

		// Validate mana (only for tiered spells that cost mana; a class pool
		// cost is validated on the activation path instead)
		if (baseMana > 0 && !isPoolCost) {
			if (manaToSpend < baseMana) {
				ui.notifications?.warn(
					format(spellUpcastDialog.warnings.minMana, { min: String(baseMana) }),
				);
				return;
			}
			if (enforceManaCost && manaToSpend > currentMana) {
				ui.notifications?.warn(
					format(spellUpcastDialog.warnings.insufficientMana, {
						current: String(currentMana),
						needed: String(manaToSpend),
					}),
				);
				return;
			}
		}

		if (manaToSpend > maxTier) {
			ui.notifications?.warn(
				format(spellUpcastDialog.warnings.aboveMaxTier, { maxTier: String(maxTier) }),
			);
			return;
		}

		const activationData = {
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
				? {
						manaToSpend,
						choiceIndex: hasChoices ? choiceIndex : undefined,
					}
				: undefined,
		};
		dialog.submitActivation(activationData);
	}
</script>

<RollWindow
	title={spellName}
	img={spell?.parent?.img ?? dialog?.item?.img}
	rollIcon="fa-solid fa-wand-magic-sparkles"
	rollLabel={format(spellUpcastDialog.castSpell)}
	oncancel={() => dialog.close()}
	onroll={onCast}
>
	{#if spendLine}
		<p class="note nimble-spell-cost">{spendLine}</p>
	{/if}

	{#if effectiveCastTier !== null}
		<p class="note nimble-spell-pinned-tier">
			{format(spellUpcastDialog.castsAtTier, { tier: String(effectiveCastTier) })}
		</p>
	{/if}

	{#if keptAmount}
		<KeptAmountField
			label={keptAmount.label}
			amount={keptAmount.value}
			bind:checked={usesKeptAmount}
		/>
	{/if}

	{#if damageMultiplier && !keptInUse}
		<DamageMultiplierField
			label={damageMultiplier.label}
			multiplier={damageMultiplier.multiplier}
			bind:checked={usesDamageMultiplier}
		/>
	{/if}

	{#if !keptInUse}
		<RollModeField bind:value={selectedRollMode} rushedAttack={data.rushedAttack} />
		<SituationalRollModeList
			options={conditionOptions}
			bind:value={selectedRollMode}
			bind:applied={appliedTicks}
		/>

		<MaxDamageField {offers} bind:choice={maxDamageChoice} />
	{/if}
	{#if offersLessMana}<LessManaField bind:checked={lessMana} />{/if}

	{#if held.choosing}
		<HeldChangeLines lines={held.lines} choosing bind:chosen={held.chosen} />
	{:else if !maxDamageChoice && !keptInUse}
		<HeldChangeLines lines={held.lines} />
	{/if}

	{#if !maxDamageChoice && !keptInUse}
		<RollModifierFields bind:situationalModifiers bind:primaryDieValue bind:primaryDieModifier />
	{/if}

	{#if canUpcast}
		{#if pinnedCastTier === null}
			<div>
				<div class="lb">{localize('NIMBLE.rollWindow.castAtTier')}</div>
				<div class="tiers" role="group" aria-label={localize('NIMBLE.rollWindow.castAtTier')}>
					{#each tiers as tier (tier)}
						<button
							type="button"
							class="nimble-u-reset-button tier"
							class:on={tier === manaToSpend}
							class:short={tier > currentMana}
							aria-pressed={tier === manaToSpend}
							data-tooltip={localize(
								`NIMBLE.rollWindow.${tier === baseMana ? 'tierBase' : 'tierUpcast'}`,
								{ tier: String(tier) },
							)}
							onclick={() => (manaToSpend = tier)}
						>
							{tier}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if hasChoices && spell.scaling.choices && upcastSteps > 0}
			<fieldset class="choices">
				<legend class="lb">{format(spellUpcastDialog.chooseEnhancement)}</legend>
				{#each spell.scaling.choices as choice, i}
					<label class="check">
						<input type="radio" name="upcast-choice" value={i} bind:group={choiceIndex} />
						<span>{choice.label}</span>
					</label>
				{/each}
			</fieldset>
		{/if}

		{#if upcastSteps > 0 && upcastPreview().length > 0}
			<div class="effect">
				<div class="lb">{format(spellUpcastDialog.appliedEffect)}</div>
				<ul>
					{#each upcastPreview() as effect}
						<li>{effect}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	{#if game.user?.isGM}
		<label class="check">
			<input type="checkbox" bind:checked={shouldRollBeHidden} />
			<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
			<span>{skillCheckDialog.hideRoll}</span>
		</label>
	{/if}
</RollWindow>

<style>
	.note {
		margin: 0;
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}
	.tiers {
		display: flex;
		gap: 4px;
	}
	.tier {
		flex: 1;
		min-width: 0;
		height: 30px;
		display: grid;
		place-items: center;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font-size: 0.781rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.tier:hover {
		border-color: var(--nimble-ui-highlight);
	}
	.tier:focus-visible {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.tier.short {
		border-style: dashed;
	}
	.tier.on {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-soft);
		box-shadow: inset 0 0 0 1px var(--nimble-ui-highlight);
		font-weight: 900;
	}
	.choices {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.choices legend {
		padding: 0;
	}
	.effect {
		padding: 8px 9px;
		border-radius: 4px;
		background: var(--nimble-ui-well);
		font-size: 0.781rem;
		font-weight: 600;
		line-height: 1.35;
	}
	.effect .lb {
		margin-bottom: 3px;
	}
	.effect ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
