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
	let selectedAttackType = $derived(activationData.targets?.attackType || '');
	let distance = $derived(activationData.targets?.distance ?? 1);

	const attackTypeOptions = [
		{ value: '', label: game.i18n.localize('NIMBLE.itemConfig.attackTypes.none') },
		{ value: 'reach', label: game.i18n.localize('NIMBLE.itemConfig.attackTypes.reach') },
		{ value: 'range', label: game.i18n.localize('NIMBLE.itemConfig.attackTypes.range') },
	];
</script>

<section>
	<header class="nimble-section-header">
		<h4 class="nimble-heading" data-heading-variant="section">
			{game.i18n.localize('NIMBLE.itemConfig.targets')}
		</h4>
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

		<span class="nimble-field__label"
			>{game.i18n.localize('NIMBLE.itemConfig.acquireTargetsFromTemplate')}</span
		>
	</label>

	{#if activationData.acquireTargetsFromTemplate}
		<TemplateConfig {activationData} {toggleTemplateShapeOption} />
	{/if}

	<div style="display: flex; gap: 0.5rem; margin-block-start: 0.5rem;">
		{#if !activationData.acquireTargetsFromTemplate}
			<label>
				<header class="nimble-section-header">
					<h4 class="nimble-heading" data-heading-variant="field">
						{game.i18n.localize('NIMBLE.itemConfig.targetCount')}
					</h4>
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
				<h4 class="nimble-heading" data-heading-variant="field">
					{game.i18n.localize('NIMBLE.itemConfig.targetRestrictions')}
				</h4>
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
					<h4 class="nimble-heading" data-heading-variant="field">
						{game.i18n.localize('NIMBLE.itemConfig.attackType')}
					</h4>
				</header>

				<select
					value={selectedAttackType}
					onchange={({ target }) =>
						document.update({
							'system.activation.targets.attackType': target?.value,
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
						<h4 class="nimble-heading" data-heading-variant="field">
							{game.i18n.localize('NIMBLE.itemConfig.distance')}
						</h4>
					</header>

					<input
						type="number"
						min="1"
						value={distance}
						onchange={({ target }) =>
							document.update({
								'system.activation.targets.distance': target?.value,
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
