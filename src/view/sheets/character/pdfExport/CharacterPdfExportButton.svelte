<script lang="ts">
	import type { CharacterPdfExportButtonProps } from '#types/components/CharacterPdfExportButton.js';
	import localize from '#utils/localize.ts';
	import PdfExportDialog from '../../../dialogs/PdfExportDialog.svelte';
	import { createCharacterPdfExportButtonState } from './CharacterPdfExportButtonState.svelte.ts';

	const { actor }: CharacterPdfExportButtonProps = $props();

	const state = createCharacterPdfExportButtonState(() => actor, PdfExportDialog);
	const { handleExport } = state;
</script>

<button
	class="nimble-button"
	data-button-variant="full-width"
	type="button"
	disabled={state.isExporting}
	onclick={handleExport}
>
	{#if state.isExporting}
		<i class="fa-solid fa-spinner fa-spin"></i>
		{localize('NIMBLE.pdfExport.exporting')}
	{:else}
		<i class="fa-solid fa-file-pdf"></i>
		{localize('NIMBLE.pdfExport.exportButton')}
	{/if}
</button>
