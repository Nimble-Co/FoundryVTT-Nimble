<script lang="ts">
	import type { CharacterPdfExportButtonProps } from '#types/components/CharacterPdfExportButton.js';

	import GenericDialog from '#documents/dialogs/GenericDialog.svelte.ts';
	import localize from '#utils/localize.ts';

	import PdfExportDialog from '../../../dialogs/PdfExportDialog.svelte';

	const { actor }: CharacterPdfExportButtonProps = $props();

	let isExporting = $state(false);

	async function handleExport() {
		if (isExporting) return;

		// Open the PDF export dialog
		const uniqueId = `pdf-export-${actor.id}`;

		// Check if dialog is already open for this character
		if (GenericDialog.isOpen(uniqueId)) {
			return;
		}

		const dialog = GenericDialog.getOrCreate(
			localize('NIMBLE.pdfExport.dialogTitle'),
			PdfExportDialog as unknown as Parameters<typeof GenericDialog>[1],
			{ actor },
			{
				icon: 'fa-solid fa-file-pdf',
				width: 900,
				uniqueId,
			},
		);

		dialog.render(true);

		// Wait for dialog result
		const result = await dialog.promise;

		if (result?.columnContent) {
			isExporting = true;

			try {
				const { exportCharacterPdf } = await import('./exportCharacterPdf.ts');
				await exportCharacterPdf(actor, {
					columnContent: result.columnContent as [string, string, string],
					template: result.template ?? 'lined',
				});
				ui.notifications?.info(localize('NIMBLE.pdfExport.success'));
			} catch (error) {
				console.error('PDF export failed:', error);
				ui.notifications?.error(localize('NIMBLE.pdfExport.error'));
			} finally {
				isExporting = false;
			}
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
