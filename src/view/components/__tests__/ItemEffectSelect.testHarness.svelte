<script lang="ts">
	import type { ItemEffectSelectProps } from '#types/components/ItemEffectSelect.d.ts';
	import ItemEffectSelect from '../ItemEffectSelect.svelte';

	let props: ItemEffectSelectProps = $props();
</script>

<ItemEffectSelect {...props} />
