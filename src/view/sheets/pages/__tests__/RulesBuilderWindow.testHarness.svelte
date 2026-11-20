<script lang="ts">
	import RulesBuilderWindow from '#view/rulesBuilder/RulesBuilderWindow.svelte';

	let { document } = $props();
</script>

<RulesBuilderWindow {document} />
