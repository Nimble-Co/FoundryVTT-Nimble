import type { NimbleCharacter } from '#documents/actor/character.js';
import type { PreviewState } from '#types/components/PdfPreviewDialog.js';

import { generatePdfPreviewUrl } from '../sheets/character/pdfExport/exportCharacterPdf.ts';

export function createPdfPreviewDialogState(
	getActor: () => NimbleCharacter,
	getPreviewState: () => PreviewState,
) {
	let previewUrl = $state<string | null>(null);
	let isGenerating = $state(true);
	let hasError = $state(false);

	$effect(() => {
		const { columnContent, template } = getPreviewState();

		isGenerating = true;
		hasError = false;

		let cancelled = false;
		let objectUrl: string | null = null;

		generatePdfPreviewUrl(getActor(), { columnContent, template })
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

	return {
		get previewUrl() {
			return previewUrl;
		},
		get isGenerating() {
			return isGenerating;
		},
		get hasError() {
			return hasError;
		},
	};
}
