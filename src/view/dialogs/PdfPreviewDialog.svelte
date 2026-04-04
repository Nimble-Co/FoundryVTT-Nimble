<script lang="ts">
	import type { NimbleCharacter } from '#documents/actor/character.js';
	import { onMount } from 'svelte';

	import localize from '#utils/localize.ts';

	import {
		generatePdfPreviewUrl,
		type TemplateType,
	} from '../sheets/character/pdfExport/exportCharacterPdf.ts';

	interface PdfPreviewDialogProps {
		actor: NimbleCharacter;
		columnContent: [string, string, string];
		template: TemplateType;
		dialog: { close(): void };
	}

	let { actor, columnContent, template, dialog: _dialog }: PdfPreviewDialogProps = $props();

	let previewUrl = $state<string | null>(null);
	let isGenerating = $state(true);

	// Generate preview on mount (only once)
	onMount(() => {
		generatePreview();

		// Cleanup on unmount
		return () => {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
		};
	});

	async function generatePreview() {
		isGenerating = true;
		try {
			const url = await generatePdfPreviewUrl(actor, {
				columnContent,
				template,
			});
			previewUrl = url;
		} finally {
			isGenerating = false;
		}
	}
</script>

<article class="nimble-sheet__body pdf-preview-dialog">
	{#if isGenerating}
		<div class="pdf-preview-dialog__loading">
			<i class="fa-solid fa-spinner fa-spin"></i>
			{localize('NIMBLE.pdfExport.generatingPreview')}
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
