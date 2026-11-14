<script lang="ts">
	import type { EffectStepRowProps } from '#types/components/EffectStepRow.d.ts';

	let {
		img,
		name,
		lasts = '',
		appliedLines,
		notes,
		button,
		busy,
		onApply,
	}: EffectStepRowProps = $props();
</script>

<div class="nimble-apply-effect">
	<img class="nimble-apply-effect__img" src={img} alt="" />

	<div class="nimble-apply-effect__text">
		<span class="nimble-apply-effect__name">{name}</span>

		{#if lasts}
			<span class="nimble-apply-effect__lasts">
				<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
				<span>{lasts}</span>
			</span>
		{/if}
	</div>

	{#if appliedLines.length}
		<span class="nimble-apply-effect__applied">
			{#each appliedLines as line}
				<span class="nimble-apply-effect__applied-line">
					<i class="fa-solid fa-check" aria-hidden="true"></i>
					<span>{line}</span>
				</span>
			{/each}
		</span>
	{:else if button}
		<button
			class="nimble-button nimble-apply-effect__button"
			type="button"
			disabled={button.disabled || busy}
			data-tooltip={button.tooltip}
			onclick={onApply}
		>
			<i class="nimble-button__icon fa-solid fa-crosshairs" aria-hidden="true"></i>
			{button.label}
		</button>
	{/if}

	{#each notes as note}
		<span class="nimble-apply-effect__note">{note}</span>
	{/each}
</div>

<style lang="scss">
	// The applied lines and the note take a full line under the name, so no word breaks in a narrow column.
	.nimble-apply-effect {
		--nimble-apply-effect-img-size: 2rem;
		--nimble-apply-effect-gap: 0.5rem;

		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem var(--nimble-apply-effect-gap);
		min-width: 0;

		&__img {
			flex: 0 0 auto;
			width: var(--nimble-apply-effect-img-size);
			height: var(--nimble-apply-effect-img-size);
			border: 0;
			border-radius: 4px;
			object-fit: cover;
		}

		&__text {
			display: flex;
			flex: 1 1 0;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 700;
			line-height: 1.2;
			overflow-wrap: break-word;
		}

		&__lasts {
			display: flex;
			align-items: flex-start;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			line-height: 1.3;
			color: var(--nimble-medium-text-color);

			i {
				flex: 0 0 auto;
				margin-block-start: 0.125rem;
			}
		}

		&__button {
			display: flex;
			flex: 0 0 auto;
			align-items: center;
			gap: 0.375rem;
			min-height: 1.5rem;
			padding: 0.25rem 0.5rem;
			font-size: var(--nimble-sm-text);
			white-space: nowrap;
		}

		&__applied,
		&__note {
			flex: 1 0 100%;
			min-width: 0;
			padding-inline-start: calc(
				var(--nimble-apply-effect-img-size) + var(--nimble-apply-effect-gap)
			);
			font-size: var(--nimble-sm-text);
			line-height: 1.3;
			overflow-wrap: break-word;
		}

		&__applied {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			font-weight: 600;
			color: var(--nimble-dark-text-color);
		}

		&__applied-line {
			display: flex;
			align-items: baseline;
			gap: 0.25rem;

			i {
				flex: 0 0 auto;
			}
		}

		&__note {
			color: var(--nimble-medium-text-color);
		}
	}
</style>
