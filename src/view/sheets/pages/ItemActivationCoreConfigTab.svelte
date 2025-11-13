<script>
	import { getContext } from 'svelte';

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
		<h4 class="nimble-heading" data-heading-variant="section">Description</h4>
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

		<span class="nimble-field__label"> Output item description on activation </span>
	</label>
</section>

{#if document.type !== 'monsterFeature'}
	<section>
		<label>
			<header class="nimble-section-header">
				<h4 class="nimble-heading" data-heading-variant="section">Activation Cost</h4>
			</header>

			<div style="display: flex; align-items: center; gap: 0.5rem">
				{#if ['action', 'minute', 'hour'].includes(activationCostType)}
					<input
						type="number"
						value={activationCost}
						onchange={({ target }) =>
							document.update({
								'system.activation.cost.quantity': target?.value,
							})}
					/>
				{/if}

				<select
					onchange={({ target }) =>
						document.update({
							'system.activation.cost.type': target.value,
						})}
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
					document.update({
						'system.activation.cost.isReaction': target.checked,
					});
				}}
			/>

			<span class="nimble-field__label"> Is Reaction </span>
		</label>

		{#if isReaction || activationCostType === 'special'}
			<label class="nimble-field" data-field-variant="stacked">
				<span class="nimble-heading" data-heading-variant="field">
					{#if isReaction}
						Reaction Trigger
					{:else}
						Activation Cost Details
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
			<h4 class="nimble-heading" data-heading-variant="section">Duration</h4>
		</header>

		<div style="display: flex; align-items: center; gap: 0.5rem">
			{#if ['action', 'minute', 'hour', 'round', 'turn'].includes(durationType)}
				<input
					type="number"
					value={duration}
					onchange={({ target }) =>
						document.update({
							'system.activation.duration.cost.quantity': target?.value,
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
			<span class="nimble-heading" data-heading-variant="field"> Duration Details </span>

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
