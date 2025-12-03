<script>
	import TemplateConfig from '../components/TemplateConfig.svelte';

	import { getContext } from 'svelte';

	async function toggleTemplateShapeOption(selectedShape) {
		await document.update({ 'system.activation.template.shape': selectedShape });
	}

	let document = getContext('document');
	let _application = getContext('application');
	let activationData = $derived(document.reactive.system.activation);
	let targetCount = $derived(activationData.targets.count);
	let targetRestrictions = $derived(activationData.targets.restrictions);
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
						'system.activation.cost.details': target?.value,
					})}
			/>
		</label>
	</div>
</section>

<style>
	input[type='number'] {
		width: 10ch;
		text-align: center;
	}
</style>
