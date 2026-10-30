<script lang="ts">
	import type { RollRerollButtonProps } from '#types/components/RollRerollButton.d.ts';
	import RollRerollButton from '../RollRerollButton.svelte';

	let props: RollRerollButtonProps = $props();
</script>

<RollRerollButton {...props} />
