<script>
	let { document, handler, metadata, sourceLabel, getTooltip, ...attributes } = $props();

	let tooltipContent = $state('');

	async function handleMouseEnter(event) {
		if (tooltipContent || !getTooltip) return;

		const content = await getTooltip(document);
		tooltipContent = content;
		event.currentTarget.setAttribute('data-tooltip', content);
	}
</script>

<button
	class="nimble-card"
	{...attributes}
	data-tooltip={tooltipContent}
	data-tooltip-class="nimble-tooltip nimble-tooltip--item"
	data-tooltip-direction="RIGHT"
	onclick={() => handler?.(document)}
	onmouseenter={handleMouseEnter}
>
	<img class="nimble-card__img" src={document.img} alt={document.name} />

	<h3 class="nimble-card__title nimble-heading" data-heading-variant="item">
		{document.name}
	</h3>

	{#if metadata || sourceLabel}
		<span class="nimble-card__meta">
			{#if metadata}{metadata}{/if}
			{#if sourceLabel}
				<span class="nimble-card__source-label">{sourceLabel}</span>
			{/if}
		</span>
	{/if}
</button>

<style lang="scss">
	.nimble-card__meta {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.375rem;
	}

	.nimble-card__source-label {
		flex-shrink: 0;
		padding: 0.0625rem 0.25rem;
		font-size: var(--nimble-xxs-text);
		font-weight: 600;
		line-height: 1.4;
		color: var(--nimble-medium-text-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 2px;
	}
</style>
