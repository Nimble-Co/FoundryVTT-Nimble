<script lang="ts">
	import type { SystemSettings } from '../../settings/SystemSettings.js';

	const { dialog }: { dialog: SystemSettings } = $props();

	const _settings = dialog.getSettings();
</script>
