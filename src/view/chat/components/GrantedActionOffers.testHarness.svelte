<script lang="ts">
	import { setContext, untrack } from 'svelte';
	import GrantedActionOffers from './GrantedActionOffers.svelte';

	let { messageDocument } = $props();

	setContext(
		'messageDocument',
		untrack(() => messageDocument),
	);
</script>

<GrantedActionOffers />
