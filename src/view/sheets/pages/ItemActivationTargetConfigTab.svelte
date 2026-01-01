<script>
	import { getContext } from 'svelte';
	import TemplateConfig from '../components/TemplateConfig.svelte';

	async function toggleTemplateShapeOption(selectedShape) {
		await document.update({ 'system.activation.template.shape': selectedShape });
	}

	let document = getContext('document');
	let activationData = $derived(document.reactive.system.activation);
	let targetCount = $derived(activationData.targets.count);
	let targetRestrictions = $derived(activationData.targets.restrictions);

	// Reach/Range support for MonsterFeature items
	let isMonsterFeature = $derived(document.type === 'monsterFeature');
	let selectedAttackType = $derived(document.reactive.system.properties?.selected || '');
	let distance = $derived(document.reactive.system.properties?.distance ?? 1);

	const attackTypeOptions = [
		{ value: '', label: 'None' },
		{ value: 'melee', label: 'Melee' },
		{ value: 'reach', label: 'Reach' },
		{ value: 'range', label: 'Range' },
	];
</script>

<section>
	<header class="nimble-section-header">
		<h4 class="nimble-heading" data-heading-variant="section">Targets</h4>
	</header>

	<label class="nimble-field">
		<input
			type="checkbox"
			checked={activationData.acquireTargetsFromTemplate}
			onchange={({ target }) =>
				document.update({
					'system.activation.acquireTargetsFromTemplate': target.checked,
				})}
		/>

		<span class="nimble-field__label"> Acquire targets from template </span>
	</label>

	{#if activationData.acquireTargetsFromTemplate}
		<TemplateConfig {activationData} {toggleTemplateShapeOption} />
	{/if}

	<div style="display: flex; gap: 0.5rem; margin-block-start: 0.5rem;">
		{#if !activationData.acquireTargetsFromTemplate}
			<label>
				<header class="nimble-section-header">
					<h4 class="nimble-heading" data-heading-variant="field">Target Count</h4>
				</header>

				<input
					type="number"
					min="1"
					value={targetCount}
					onchange={({ target }) =>
						document.update({
							'system.activation.targets.count': target?.value,
						})}
				/>
			</label>
		{/if}

		<label style="flex-grow: 1;">
			<header class="nimble-section-header">
				<h4 class="nimble-heading" data-heading-variant="field">Target Restrictions</h4>
			</header>

			<input
				type="text"
				value={targetRestrictions}
				onchange={({ target }) =>
					document.update({
						'system.activation.targets.restrictions': target?.value,
					})}
			/>
		</label>
	</div>

	{#if isMonsterFeature}
		<div class="attack-type-row">
			<label>
				<header class="nimble-section-header">
					<h4 class="nimble-heading" data-heading-variant="field">Attack Type</h4>
				</header>

				<select
					value={selectedAttackType}
					onchange={({ target }) =>
						document.update({
							'system.properties.selected': target?.value,
						})}
				>
					{#each attackTypeOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>

			{#if selectedAttackType === 'reach' || selectedAttackType === 'range'}
				<label>
					<header class="nimble-section-header">
						<h4 class="nimble-heading" data-heading-variant="field">Distance</h4>
					</header>

					<input
						type="number"
						min="1"
						value={distance}
						onchange={({ target }) =>
							document.update({
								'system.properties.distance': target?.value,
							})}
					/>
				</label>
			{/if}
		</div>
	{/if}
</section>

<style>
	input[type='number'] {
		width: 10ch;
		text-align: center;
	}

	.attack-type-row {
		display: flex;
		gap: 0.5rem;
		margin-block-start: 0.5rem;
	}
</style>
