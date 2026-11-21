<script lang="ts">
	import { untrack } from 'svelte';
	import { SYSTEM_ID } from '#system';
	import localize from '#utils/localize.js';
	import {
		createSpellUpcastDialogState,
		type OptionControlsView,
	} from './spellUpcastDialogState.svelte.ts';
	import AmountStepper from './components/AmountStepper.svelte';
	import KeptAmountField from './components/KeptAmountField.svelte';
	import DamageMultiplierField from './components/DamageMultiplierField.svelte';
	import HeldChangeLines from './components/HeldChangeLines.svelte';
	import LessManaField from './components/LessManaField.svelte';
	import MaxDamageField from './components/MaxDamageField.svelte';
	import RollModeField from './components/RollModeField.svelte';
	import RollModifierFields from './components/RollModifierFields.svelte';
	import RollWindow from './components/RollWindow.svelte';
	import SituationalRollModeList from './components/SituationalRollModeList.svelte';

	let { actor, dialog, spell, ...data } = $props();

	// `spell` is the item's system DataModel; its `parent` is the item document.
	const spellName = $derived(spell?.parent?.name ?? dialog?.item?.name ?? '');

	const { spellUpcastDialog, skillCheckDialog } = CONFIG.NIMBLE;

	const upcast = createSpellUpcastDialogState({
		actor: () => actor,
		spell: () => spell,
		item: () => dialog?.item,
		initialRollMode: untrack(() => data.rollMode),
		// @ts-expect-error - nimble isn't included in the type
		hideRollsDefault: !!game.settings.get(SYSTEM_ID, 'hideRolls'),
		ignoresDisadvantage: untrack(() => data.ignoreDisadvantage),
		pinnedCastTier: untrack(() => data.pinnedCastTier),
		spellCost: untrack(() => data.spellCost),
		spendsActions: untrack(() => data.spendsActions),
		resourceCosts: untrack(() => data.resourceCosts ?? []),
		useOptionGroups: untrack(() => data.useOptionGroups ?? []),
	});

	/** The amount of the chosen option of a group, after the state kept it in range. */
	function amountOf(key: string): number | undefined {
		const view =
			upcast.spendChoice?.key === key
				? upcast.spendChoice
				: upcast.optionGroups.find((each) => each.key === key);
		return view?.amount?.amount;
	}

	function onCast() {
		if (upcast.castWarning) {
			ui.notifications?.warn(upcast.castWarning);
			return;
		}
		dialog.submitActivation(upcast.castData);
	}
</script>

{#snippet optionControls(key: string, label: string, group: OptionControlsView)}
	{#if group.picks.length > 0}
		<div class="tiers" role="group" aria-label={label}>
			{#each group.picks as pick (pick.key)}
				<button
					type="button"
					class="nimble-u-reset-button tier"
					class:on={pick.key === group.pick}
					aria-pressed={pick.key === group.pick}
					onclick={() => upcast.chooseOptionPick(key, pick.key)}
				>
					{pick.label}
				</button>
			{/each}
		</div>
	{/if}
	{#if group.amount}
		{@const word = localize(`NIMBLE.useOptions.amountLabel.${group.amount.kind}`)}
		<AmountStepper
			label={group.amountLabel}
			value={group.amount.amount}
			minimum={group.amount.minimum}
			limit={group.amount.limit}
			words={{
				decrement: localize('NIMBLE.useOptions.decrement', { label: word }),
				increment: localize('NIMBLE.useOptions.increment', { label: word }),
				amount: word,
			}}
			onadjust={(delta) => upcast.setOptionAmount(key, (group.amount?.amount ?? 0) + delta)}
			onset={(value) => {
				upcast.setOptionAmount(key, value);
				return amountOf(key) ?? value;
			}}
		/>
	{/if}
{/snippet}

<RollWindow
	title={spellName}
	img={spell?.parent?.img ?? dialog?.item?.img}
	rollIcon="fa-solid fa-wand-magic-sparkles"
	rollLabel={localize(spellUpcastDialog.castSpell)}
	oncancel={() => dialog.close()}
	onroll={onCast}
>
	{#if upcast.spendLine}
		<p class="note nimble-spell-cost">{upcast.spendLine}</p>
	{/if}

	{#if upcast.effectiveCastTier !== null}
		<p class="note nimble-spell-pinned-tier">
			{localize(spellUpcastDialog.castsAtTier, { tier: String(upcast.effectiveCastTier) })}
		</p>
	{/if}

	{#if upcast.keptAmount}
		<KeptAmountField
			label={upcast.keptAmount.label}
			amount={upcast.keptAmount.value}
			bind:checked={upcast.usesKeptAmount}
		/>
	{/if}

	{#if upcast.damageMultiplier && !upcast.keptInUse}
		<DamageMultiplierField
			label={upcast.damageMultiplier.label}
			multiplier={upcast.damageMultiplier.multiplier}
			bind:checked={upcast.usesDamageMultiplier}
		/>
	{/if}

	{#if !upcast.keptInUse}
		<RollModeField bind:value={upcast.selectedRollMode} rushedAttack={data.rushedAttack} />
		<SituationalRollModeList
			options={upcast.conditionOptions}
			bind:value={upcast.selectedRollMode}
			bind:applied={upcast.appliedTicks}
		/>

		<MaxDamageField offers={upcast.maxDamageOffers} bind:choice={upcast.maxDamageChoice} />
	{/if}
	{#if upcast.offersLessMana}<LessManaField bind:checked={upcast.lessMana} />{/if}

	{#if upcast.choosesHeldChanges}
		<HeldChangeLines lines={upcast.heldLines} choosing bind:chosen={upcast.chosenHeldChanges} />
	{:else if !upcast.maxDamageChoice && !upcast.keptInUse}
		<HeldChangeLines lines={upcast.heldLines} />
	{/if}

	{#if !upcast.maxDamageChoice && !upcast.keptInUse}
		<RollModifierFields
			bind:situationalModifiers={upcast.situationalModifiers}
			bind:primaryDieValue={upcast.primaryDieValue}
			bind:primaryDieModifier={upcast.primaryDieModifier}
		/>
	{/if}

	{#if upcast.spendChoice}
		{@const choice = upcast.spendChoice}
		<div class="option-group">
			<div class="lb">{choice.label}</div>
			<div class="tiers" role="group" aria-label={choice.label}>
				{#each choice.buttons as button (button.key)}
					<button
						type="button"
						class="nimble-u-reset-button tier spend"
						class:on={button.key === choice.chosen}
						aria-pressed={button.key === choice.chosen}
						disabled={button.disabled}
						onclick={() => upcast.chooseOption(choice.key, button.key)}
					>
						{button.label}
					</button>
				{/each}
			</div>
			{@render optionControls(choice.key, choice.label, choice)}
		</div>
	{/if}

	{#if upcast.canUpcast}
		{#if upcast.pinnedCastTier === null}
			<div>
				<div class="lb">{localize('NIMBLE.rollWindow.castAtTier')}</div>
				<div class="tiers" role="group" aria-label={localize('NIMBLE.rollWindow.castAtTier')}>
					{#each upcast.tiers as { tier, short } (tier)}
						<button
							type="button"
							class="nimble-u-reset-button tier"
							class:on={tier === upcast.manaToSpend}
							class:short
							aria-pressed={tier === upcast.manaToSpend}
							data-tooltip={localize(
								`NIMBLE.rollWindow.${tier === upcast.baseMana ? 'tierBase' : 'tierUpcast'}`,
								{ tier: String(tier) },
							)}
							onclick={() => (upcast.manaToSpend = tier)}
						>
							{tier}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if upcast.hasChoices && upcast.choices && upcast.upcastSteps > 0}
			<fieldset class="choices">
				<legend class="lb">{localize(spellUpcastDialog.chooseEnhancement)}</legend>
				{#each upcast.choices as choice, i}
					<label class="check">
						<input type="radio" name="upcast-choice" value={i} bind:group={upcast.choiceIndex} />
						<span>{choice.label}</span>
					</label>
				{/each}
			</fieldset>
		{/if}

		{#if upcast.upcastSteps > 0 && upcast.upcastPreview.length > 0}
			<div class="effect">
				<div class="lb">{localize(spellUpcastDialog.appliedEffect)}</div>
				<ul>
					{#each upcast.upcastPreview as effect}
						<li>{effect}</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	{#each upcast.optionGroups as group (group.key)}
		<div class="option-group">
			<label class="fld">
				<span>{group.label}</span>
				<select
					value={group.chosen}
					disabled={group.disabled}
					onchange={({ currentTarget }) => upcast.chooseOption(group.key, currentTarget.value)}
				>
					{#each group.entries as entry (entry.key)}
						<option value={entry.key}>{entry.label}</option>
					{/each}
				</select>
			</label>
			{#if group.note}<p class="note">{group.note}</p>{/if}
			{@render optionControls(group.key, group.label, group)}
		</div>
	{/each}

	{#if upcast.variableResourceCosts.length > 0}
		<div class="option-group">
			<h5 class="lb">{localize('NIMBLE.activationDialog.resourceCost.heading')}</h5>
			{#each upcast.variableResourceCosts as cost (cost.id)}
				{@const label = localize(`NIMBLE.activationDialog.resourceCost.label.${cost.kind}`)}
				<AmountStepper
					{label}
					value={cost.amount}
					minimum={cost.minimum}
					limit={cost.limit}
					words={{
						decrement: localize('NIMBLE.activationDialog.resourceCost.decrement', { label }),
						increment: localize('NIMBLE.activationDialog.resourceCost.increment', { label }),
						amount: label,
					}}
					onadjust={(delta) => upcast.adjustResourceAmount(cost.id, delta)}
					onset={(value) => {
						upcast.setResourceAmount(cost.id, value);
						return upcast.resourceAmounts[cost.id] ?? cost.minimum;
					}}
				/>
			{/each}
		</div>
	{/if}

	{#if game.user?.isGM}
		<label class="check">
			<input type="checkbox" bind:checked={upcast.shouldRollBeHidden} />
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
	.option-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.option-group .lb {
		margin: 0;
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
	.tier.spend {
		height: auto;
		min-height: 30px;
		padding: 4px 6px;
		text-align: center;
	}
	.tier:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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
