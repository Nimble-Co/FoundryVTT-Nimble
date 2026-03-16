<script lang="ts">
	import type { TargetSelectorProps } from '../../../../types/components/TargetSelector.d.ts';
	import localize from '../../../utils/localize.js';

	let {
		label,
		noTargetMessage,
		multipleTargetsMessage,
		availableTargets,
		selectedTarget,
		getTargetName,
		targetBackground,
		targetBorderColor,
	}: TargetSelectorProps = $props();
</script>

<div class="reaction-panel__target-section">
	<span class="reaction-panel__target-label">
		<i class="fa-solid fa-crosshairs"></i>
		{localize(label)}
	</span>
	{#if availableTargets.length === 0}
		<div class="reaction-panel__no-target">
			<span>{localize(noTargetMessage)}</span>
		</div>
	{:else if availableTargets.length === 1}
		<div
			class="reaction-panel__target"
			style="--target-bg: {targetBackground}; --target-border: {targetBorderColor};"
		>
			<img
				class="reaction-panel__target-img"
				src={selectedTarget?.document?.texture?.src || 'icons/svg/mystery-man.svg'}
				alt={getTargetName(selectedTarget)}
			/>
			<span class="reaction-panel__target-name">{getTargetName(selectedTarget)}</span>
			<i class="fa-solid fa-check reaction-panel__target-check"></i>
		</div>
	{:else}
		<div class="reaction-panel__no-target reaction-panel__no-target--warning">
			<i class="fa-solid fa-triangle-exclamation"></i>
			<span>{localize(multipleTargetsMessage)}</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.reaction-panel__target {
		background: var(--target-bg);
		border-color: var(--target-border);
	}

	.reaction-panel__target-img {
		border-color: var(--target-border);
	}
</style>
