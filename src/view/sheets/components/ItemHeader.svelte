<script>
	let { item, placeholder } = $props();
</script>

<div class="nimble-name-wrapper">
	<input
		class="nimble-heading"
		data-heading-variant="document"
		type="text"
		onchange={({ target }) => item.update({ name: target.value })}
		value={item.reactive.name}
		{placeholder}
	/>
</div>

<style>
	.nimble-name-wrapper {
		grid-area: name;
		flex-grow: 1;
		height: fit-content;
	}
</style>
