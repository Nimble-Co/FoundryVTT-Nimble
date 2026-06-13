<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';

	import localize from '#utils/localize.ts';

	import {
		generatePdfPreviewUrl,
		type TemplateType,
	} from '../sheets/character/pdfExport/exportCharacterPdf.ts';

	interface PreviewState {
		columnContent: [string, string, string];
		template: TemplateType;
	}

	interface PdfPreviewDialogProps {
		actor: NimbleCharacter;
		previewState: PreviewState;
		dialog: { close(): void };
	}

	let { actor, previewState, dialog: _dialog }: PdfPreviewDialogProps = $props();

	let previewUrl: string | null = $state(null);
	let isGenerating = $state(true);
	let hasError = $state(false);

	$effect(() => {
		// Read from reactive previewState to create dependencies — effect re-runs when either changes
		const columnContent = previewState.columnContent;
		const template = previewState.template;

		isGenerating = true;
		hasError = false;

		let cancelled = false;
		let objectUrl: string | null = null;

		generatePdfPreviewUrl(actor, { columnContent, template })
			.then((url) => {
				if (cancelled) {
					URL.revokeObjectURL(url);
					return;
				}
				objectUrl = url;
				previewUrl = url;
			})
			.catch((_err) => {
				if (!cancelled) hasError = true;
			})
			.finally(() => {
				if (!cancelled) isGenerating = false;
			});

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
			previewUrl = null;
		};
	});
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
