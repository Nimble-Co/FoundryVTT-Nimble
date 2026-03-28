<script lang="ts">
	import type { CharacterPdfExportButtonProps } from '#types/components/CharacterPdfExportButton.js';

	import localize from '#utils/localize.ts';

	const { actor }: CharacterPdfExportButtonProps = $props();

	let isExporting = $state(false);

	async function handleExport() {
		if (isExporting) return;

		isExporting = true;

		try {
			// Dynamically import to avoid bundle bloat
			const { exportCharacterPdf } = await import('./exportCharacterPdf.ts');
			await exportCharacterPdf(actor);
			ui.notifications?.info(localize('NIMBLE.pdfExport.success'));
		} catch (error) {
			console.error('PDF export failed:', error);
			ui.notifications?.error(localize('NIMBLE.pdfExport.error'));
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
		{localize('NIMBLE.pdfExport.exporting')}
	{:else}
		<i class="fa-solid fa-file-pdf"></i>
		{localize('NIMBLE.pdfExport.exportButton')}
	{/if}
</button>
