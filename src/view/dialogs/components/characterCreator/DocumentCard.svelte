<script>
	let { document, handler, metadata, tooltip, ...attributes } = $props();
</script>

<button
	class="nimble-card"
	{...attributes}
	data-tooltip={tooltip}
	data-tooltip-class="nimble-tooltip nimble-tooltip--item"
	data-tooltip-direction="RIGHT"
	onclick={() => handler?.(document)}
>
	<img class="nimble-card__img" src={document.img} alt={document.name} />

	<h3 class="nimble-card__title nimble-heading" data-heading-variant="item">
		{document.name}
	</h3>

	{#if metadata}
		<span class="nimble-card__meta">{metadata}</span>
	{/if}
</button>
