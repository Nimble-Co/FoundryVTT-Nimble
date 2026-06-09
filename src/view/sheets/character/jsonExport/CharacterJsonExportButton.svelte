<script lang="ts">
	import type { CharacterJsonExportButtonProps } from '#types/components/CharacterJsonExportButton.js';

	import localize from '#utils/localize.ts';

	const { actor }: CharacterJsonExportButtonProps = $props();

	let isExporting = $state(false);

	async function handleExport() {
		if (isExporting) return;

		isExporting = true;

		try {
			// Foundry core: serializes the actor + all embedded documents and
			// triggers the download itself.
			await actor.exportToJSON();
			ui.notifications?.info(localize('NIMBLE.jsonExport.success'));
		} catch (error) {
			console.error('Character JSON export failed:', error);
			ui.notifications?.error(localize('NIMBLE.jsonExport.error'));
		} finally {
			isExporting = false;
		}
	}
</script>

<button
	class="nimble-button"
	data-button-variant="full-width"
	type="button"
	disabled={isExporting}
	onclick={handleExport}
>
	{#if isExporting}
		<i class="fa-solid fa-spinner fa-spin"></i>
		{localize('NIMBLE.jsonExport.exporting')}
	{:else}
		<i class="fa-solid fa-file-export"></i>
		{localize('NIMBLE.jsonExport.exportButton')}
	{/if}
</button>
