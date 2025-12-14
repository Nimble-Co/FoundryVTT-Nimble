<script>
	let { document, handler, metadata, getTooltip, ...attributes } = $props();

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

	{#if metadata}
		<span class="nimble-card__meta">{metadata}</span>
	{/if}
</button>
