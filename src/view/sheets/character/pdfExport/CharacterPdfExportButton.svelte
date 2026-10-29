<script lang="ts">
	import type { CharacterPdfExportButtonProps } from '#types/components/CharacterPdfExportButton.js';
	import localize from '#utils/localize.ts';
	import { openPdfExportDialog } from '#view/dialogs/openPdfExportDialog.ts';

	const { actor }: CharacterPdfExportButtonProps = $props();

	const handleExport = () => openPdfExportDialog(actor);
</script>

<button class="nimble-button" data-button-variant="full-width" type="button" onclick={handleExport}>
	<i class="fa-solid fa-file-pdf"></i>
	{localize('NIMBLE.pdfExport.exportButton')}
</button>
