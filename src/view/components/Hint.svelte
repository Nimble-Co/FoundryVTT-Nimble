<script>
	let { hintIcon = 'fa-solid fa-circle-info', hintText, hintType = 'info' } = $props();
</script>

<small
	class="nimble-hint"
	class:nimble-hint--info={['general', 'flavor', 'info', 'reminder'].includes(hintType)}
	class:nimble-hint--warning={hintType === 'warning'}
>
	{#if hintIcon}
		<i class="nimble-hint__icon {hintIcon}"></i>
	{/if}

	{hintText}
</small>
