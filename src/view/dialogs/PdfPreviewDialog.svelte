<script lang="ts">
	import type { PdfPreviewDialogProps } from '#types/components/PdfPreviewDialog.js';
	import localize from '#utils/localize.ts';
	import { createPdfPreviewDialogState } from './PdfPreviewDialogState.svelte.ts';

	let { actor, previewState }: PdfPreviewDialogProps = $props();

	const state = createPdfPreviewDialogState(
		() => actor,
		() => previewState,
	);
	const isGenerating = $derived(state.isGenerating);
	const hasError = $derived(state.hasError);
	const previewUrl = $derived(state.previewUrl);
</script>

<article class="nimble-sheet__body pdf-preview-dialog">
	{#if isGenerating}
		<div class="pdf-preview-dialog__loading">
			<i class="fa-solid fa-spinner fa-spin"></i>
			{localize('NIMBLE.pdfExport.generatingPreview')}
		</div>
	{:else if hasError}
		<div class="pdf-preview-dialog__loading">
			{localize('NIMBLE.pdfExport.error')}
		</div>
	{:else if previewUrl}
		<iframe src={previewUrl} class="pdf-preview-dialog__iframe" title="PDF Preview"></iframe>
	{/if}
</article>

<style lang="scss">
	.pdf-preview-dialog {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: 0.5rem;

		&__loading {
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			color: var(--nimble-medium-text-color);
			font-size: var(--nimble-sm-text);
		}

		&__iframe {
			flex: 1;
			width: 100%;
			height: 100%;
			border: none;
			border-radius: 4px;
			background: white;
		}
	}
</style>
