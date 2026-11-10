<script lang="ts">
	import ApplyEffectNodeConfig from '../ApplyEffectNodeConfig.svelte';

	let { document, effects } = $props();
</script>

{#each effects.filter((node) => node.type === 'applyEffect') as node (node.id)}
	<ApplyEffectNodeConfig {node} {document} {effects} />
{/each}
