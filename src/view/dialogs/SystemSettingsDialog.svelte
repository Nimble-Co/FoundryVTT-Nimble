<script lang="ts">
	import type { SystemSettings } from '../../settings/SystemSettings.js';

	import { setContext } from 'svelte';

	const { dialog }: { dialog: SystemSettings } = $props();

	const settings = dialog.getSettings();
</script>
