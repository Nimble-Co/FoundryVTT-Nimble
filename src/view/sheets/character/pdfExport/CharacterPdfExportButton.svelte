<script lang="ts">
	import type { CharacterPdfExportButtonProps } from '#types/components/CharacterPdfExportButton.js';
	import localize from '#utils/localize.ts';
	import PdfExportDialog from '../../../dialogs/PdfExportDialog.svelte';
	import { createCharacterPdfExportButtonState } from './CharacterPdfExportButtonState.svelte.ts';

	const { actor }: CharacterPdfExportButtonProps = $props();

	const { handleExport } = createCharacterPdfExportButtonState(() => actor, PdfExportDialog);
</script>

<button class="nimble-button" data-button-variant="full-width" type="button" onclick={handleExport}>
	<i class="fa-solid fa-file-pdf"></i>
	{localize('NIMBLE.pdfExport.exportButton')}
</button>
