<script>
	import { getContext } from 'svelte';
	import prepareRollTooltip from '../../dataPreparationHelpers/rollTooltips/prepareRollTooltip.js';

	const messageDocument = getContext('messageDocument');
	const { actorType, permissions, rollMode } = messageDocument.system;
	const { healingTypes } = CONFIG.NIMBLE;

	let { node } = $props();

	let healingType = $derived(node.healingType);
	let roll = $derived(node.roll);
	let secondaryInfo = $derived(healingType === 'tempHealing' ? healingTypes[healingType] : null);
</script>

<div class="roll" class:roll--no-roll-mode={!secondaryInfo}>
	<div
		class="roll__total"
		data-tooltip={prepareRollTooltip(actorType, permissions, Roll.fromData(roll))}
		data-tooltip-class="nimble-tooltip nimble-tooltip--roll"
		data-tooltip-direction="LEFT"
	>
		{roll.total}
	</div>

	<h3 class="roll__label">Healing</h3>

	{#if secondaryInfo}
		<span class="roll__mode">
			{secondaryInfo}
		</span>
	{/if}
</div>

<style lang="scss">
	.roll {
		display: grid;
		grid-template-areas:
			'rollResult rollLabel editButton'
			'rollResult rollMode editButton';
		grid-template-columns: max-content 1fr max-content;
		gap: 0 0.5rem;

		&--no-roll-mode {
			grid-template-areas: 'rollResult rollLabel editButton';
		}

		&__label {
			grid-area: rollLabel;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin: 0;
			font-size: var(--nimble-sm-text);
			line-height: 1;
			font-weight: 900;
			border: 0;
		}

		&__mode {
			grid-area: rollMode;
			width: 100%;
			font-size: var(--nimble-xs-text);
			line-height: 1;
			color: var(--nimble-medium-text-color);
			font-weight: 500;
		}

		&__total {
			grid-area: rollResult;
			position: relative;
			display: flex;
			align-items: center;
			justify-content: center;
			height: 2.25rem;
			width: 2.5rem;
			font-size: var(--nimble-lg-text);
			font-weight: 700;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
		}
	}
</style>
