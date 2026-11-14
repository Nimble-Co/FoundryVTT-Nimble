<script>
	import { getContext } from 'svelte';

	import localize from '#utils/localize.js';
	import {
		costQuantityMin,
		costTypeUpdate,
		reactionFlagUpdate,
		showsCostQuantity,
	} from './itemActivationCostUpdates.js';

	const { activationCostTypes, durationTypes } = CONFIG.NIMBLE;

	let document = getContext('document');

	let activationData = $derived(document.reactive.system.activation);
	let activationCost = $derived(activationData.cost.quantity);
	let activationCostDetails = $derived(activationData.cost.details);
	let activationCostType = $derived(activationData.cost.type);
	let isReaction = $derived(activationData.cost.isReaction);

	let durationData = $derived(activationData.duration);
	let duration = $derived(durationData.quantity);
	let durationDetails = $derived(durationData.details);
	let durationType = $derived(durationData.type);
</script>

<section>
	<header class="nimble-section-header">
		<h4 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.itemConfig.activationOptions')}
		</h4>
	</header>

	<label class="nimble-field">
		<input
			type="checkbox"
			checked={activationData.showDescription}
			onchange={({ target }) =>
				document.update({
					'system.activation.showDescription': target.checked,
				})}
		/>

		<span class="nimble-field__label"> {localize('NIMBLE.itemConfig.outputDescription')} </span>
	</label>

	<label class="nimble-field">
		<input
			type="checkbox"
			checked={activationData.skipRollDialog}
			onchange={({ target }) =>
				document.update({
					'system.activation.skipRollDialog': target.checked,
				})}
		/>

		<span class="nimble-field__label"> {localize('NIMBLE.itemConfig.skipRollDialog')} </span>

		<i
			class="nimble-field__hint-icon fa-solid fa-circle-info"
			data-tooltip={localize('NIMBLE.itemConfig.skipRollDialogHint')}
			data-tooltip-direction="UP"
		></i>
	</label>
</section>

{#if document.type !== 'monsterFeature'}
	<section>
		<label>
			<header class="nimble-section-header">
				<h4 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.itemConfig.activationCost')}
				</h4>
			</header>

			<div style="display: flex; align-items: center; gap: 0.5rem">
				{#if showsCostQuantity(activationCostType)}
					<input
						type="number"
						min={costQuantityMin(activationCostType)}
						value={activationCost}
						onchange={({ target }) =>
							document.update({
								'system.activation.cost.quantity': target?.value,
							})}
					/>
				{/if}

				<select
					onchange={({ target }) =>
						document.update(costTypeUpdate(activationData.cost, target.value))}
				>
					{#each Object.entries(activationCostTypes) as [key, label]}
						<option value={key} selected={key === activationCostType}>
							{label}
						</option>
					{/each}
				</select>
			</div>
		</label>

		<label class="nimble-field">
			<input
				type="checkbox"
				checked={isReaction}
				onchange={({ target }) => {
					document.update(reactionFlagUpdate(activationData.cost, target.checked));
				}}
			/>

			<span class="nimble-field__label"> {localize('NIMBLE.itemConfig.isReaction')} </span>
		</label>

		{#if isReaction || activationCostType === 'special'}
			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading" data-heading-variant="field">
					{#if isReaction}
						{localize('NIMBLE.itemConfig.reactionTrigger')}
					{:else}
						{localize('NIMBLE.itemConfig.activationCostDetails')}
					{/if}
				</span>

				<input
					type="text"
					value={activationCostDetails}
					onchange={({ target }) =>
						document.update({
							'system.activation.cost.details': target?.value,
						})}
				/>
			</label>
		{/if}
	</section>
{/if}

<section>
	<label>
		<header class="nimble-section-header">
			<h4 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.itemConfig.duration')}
			</h4>
		</header>

		<div style="display: flex; align-items: center; gap: 0.5rem">
			{#if ['action', 'minute', 'hour', 'round', 'turn'].includes(durationType)}
				<input
					type="number"
					value={duration}
					onchange={({ target }) =>
						document.update({
							'system.activation.duration.quantity': target?.value,
						})}
				/>
			{/if}

			<select
				onchange={({ target }) =>
					document.update({
						'system.activation.duration.type': target.value,
					})}
			>
				{#each Object.entries(durationTypes) as [key, label]}
					<option value={key} selected={key === durationType}>
						{label}
					</option>
				{/each}
			</select>
		</div>
	</label>

	{#if durationType === 'special'}
		<label class="nimble-field" data-field-variant="stacked">
			<span class="nimble-heading" data-heading-variant="field">
				{localize('NIMBLE.itemConfig.durationDetails')}
			</span>

			<input
				type="text"
				value={durationDetails}
				onchange={({ target }) =>
					document.update({
						'system.activation.duration.details': target?.value,
					})}
			/>
		</label>
	{/if}
</section>

<style>
	input[type='number'] {
		width: 8ch;
		text-align: center;
	}

	label + label {
		margin-top: 0.5rem;
		width: 100%;
	}

	select {
		width: fit-content;
	}
</style>
